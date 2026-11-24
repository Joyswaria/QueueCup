import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import pg from 'pg'
import { buildApp } from '../src/app.ts'
import type { MarketItem } from '../src/market.ts'
import { migrate } from '../src/migrate.ts'
import type { OrderLineInput } from '../src/orders.ts'
import { calculatePriceCents } from '../src/pricing.ts'

test('pricing starts at base, rises with demand, and stops at the ceiling', () => {
  assert.equal(calculatePriceCents(250, 5, 375, 0), 250)
  assert.equal(calculatePriceCents(250, 5, 375, 2), 260)
  assert.equal(calculatePriceCents(250, 5, 375, 100), 375)
})

async function openStream(baseUrl: string, signal: AbortSignal) {
  const response = await fetch(`${baseUrl}/api/market/stream`, { signal })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream/)
  assert.ok(response.body)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return async function nextEvent() {
    while (!buffer.includes('\n\n')) {
      const { value, done } = await reader.read()
      assert.equal(done, false, 'market stream ended before the next event')
      buffer += decoder.decode(value, { stream: true })
    }
    const frameEnd = buffer.indexOf('\n\n')
    const frame = buffer.slice(0, frameEnd)
    buffer = buffer.slice(frameEnd + 2)
    const match = /^event: (.+)\ndata: (.+)$/.exec(frame)
    assert.ok(match)
    return { event: match[1], items: JSON.parse(match[2]) as MarketItem[] }
  }
}

const connectionString = process.env.TEST_DATABASE_URL

test('market, checkout and SSE against PostgreSQL', {
  skip: connectionString ? false : 'Set TEST_DATABASE_URL to run PostgreSQL integration tests',
  timeout: 25_000,
}, async t => {
  const schema = `test_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString })
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` })
  const app = buildApp(pool)
  const streams = new AbortController()

  t.after(async () => {
    streams.abort()
    try {
      await app.close()
      await pool.end()
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    } finally {
      await admin.end()
    }
  })

  await admin.query(`CREATE SCHEMA ${schema}`)
  await migrate(pool)
  await migrate(pool)
  const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 })

  async function market() {
    const response = await app.inject('/api/market')
    assert.equal(response.statusCode, 200)
    return response.json<{ items: MarketItem[] }>().items
  }

  function order(lines: OrderLineInput[], key = randomUUID()) {
    return app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'Idempotency-Key': key },
      payload: { lines },
    })
  }

  await t.test('seeds the catalog and serves the snapshot to both clients', async () => {
    assert.equal((await app.inject('/api/ready')).statusCode, 200)
    const items = await market()
    assert.equal(items.length, 8)
    assert.equal(items[0].priceCents, 250)
    assert.equal(items[0].revision, 0)

    const firstClient = new AbortController()
    const signal = AbortSignal.any([streams.signal, AbortSignal.timeout(8_000)])
    const [first, second] = await Promise.all([
      openStream(baseUrl, AbortSignal.any([signal, firstClient.signal])),
      openStream(baseUrl, signal),
    ])

    for (const next of [first, second]) {
      assert.deepEqual(await next(), { event: 'market-snapshot', items })
    }

    const key = randomUUID()
    const lines = [{ itemId: 1, quantity: 2, unitPriceCents: 250 }]
    const duplicates = await Promise.all([order(lines, key), order(lines, key)])
    assert.deepEqual(duplicates.map(response => response.statusCode).sort(), [200, 201])
    const receipt = duplicates[0].json()
    assert.deepEqual(duplicates[1].json(), receipt)
    assert.equal(receipt.totalCents, 500)
    assert.equal(receipt.lines[0].unitPriceCents, 250)

    const [espresso] = await market()
    assert.equal(espresso.priceCents, 260)
    assert.equal(espresso.demand, 2)
    assert.equal(espresso.volume, 2)
    assert.equal(espresso.revision, 1)
    for (const next of [first, second]) {
      assert.deepEqual(await next(), { event: 'market-update', items: [espresso] })
    }
    assert.equal((await order([{ ...lines[0], quantity: 3 }], key)).json().code, 'IDEMPOTENCY_CONFLICT')

    firstClient.abort()
    assert.equal((await order([{ itemId: 1, quantity: 1, unitPriceCents: 260 }])).statusCode, 201)
    const resumed = await openStream(baseUrl, signal)
    assert.deepEqual(await resumed(), { event: 'market-snapshot', items: await market() })
    assert.deepEqual((await order(lines, key)).json(), receipt)
  })

  await t.test('parallel overlapping orders cannot both use the old price', async () => {
    const [espresso, latte] = await market()
    const lines = [espresso, latte].map(item => ({ itemId: item.id, quantity: 1, unitPriceCents: item.priceCents }))
    const responses = await Promise.all([order(lines), order([...lines].reverse())])
    assert.deepEqual(responses.map(response => response.statusCode).sort(), [201, 409])
    const mismatch = responses.find(response => response.statusCode === 409)
    assert.equal(mismatch?.json().code, 'PRICE_CHANGED')
    const fresh = await market()
    assert.deepEqual(mismatch?.json().items, fresh.slice(0, 2))
    assert.equal(fresh[0].volume, espresso.volume + 1)
    assert.equal(fresh[1].volume, latte.volume + 1)
  })

  await t.test('invalid orders leave the entire market and order ledger unchanged', async () => {
    const before = await market()
    const orders = await pool.query('SELECT count(*) FROM orders')
    const validLine = { itemId: 1, quantity: 1, unitPriceCents: before[0].priceCents }
    const key = randomUUID()
    const unknownProduct = await order([validLine, { itemId: 999, quantity: 1, unitPriceCents: 100 }], key)
    const staleSecondLine = await order([validLine, { itemId: 2, quantity: 1, unitPriceCents: 100 }], key)
    const invalidQuantity = await order([{ ...validLine, quantity: 0 }], key)
    assert.equal(unknownProduct.statusCode, 400)
    assert.equal(staleSecondLine.statusCode, 409)
    assert.equal(invalidQuantity.statusCode, 400)
    assert.deepEqual(await market(), before)
    assert.deepEqual((await pool.query('SELECT count(*) FROM orders')).rows, orders.rows)
    assert.equal((await order([validLine], key)).statusCode, 201)
  })

  await t.test('a write failure on the second line rolls back the first line', async () => {
    await pool.query('UPDATE market_state SET volume = 2147483647 WHERE item_id = 2')
    const before = await market()
    const ledger = await pool.query('SELECT id FROM orders ORDER BY id')
    const lines = before.slice(0, 2).map(item => ({
      itemId: item.id,
      quantity: 1,
      unitPriceCents: item.priceCents,
    }))

    assert.equal((await order(lines)).statusCode, 500)
    assert.deepEqual(await market(), before)
    assert.deepEqual((await pool.query('SELECT id FROM orders ORDER BY id')).rows, ledger.rows)
  })
})
