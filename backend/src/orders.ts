import { createHash, randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { marketColumns, marketFrom } from './market.ts'
import type { MarketItem, MarketRow } from './market.ts'
import { calculatePriceCents } from './pricing.ts'

export type OrderLineInput = {
  itemId: number
  quantity: number
  unitPriceCents: number
}

type OrderRow = {
  id: string
  createdAt: Date
  totalCents: number
}

type Receipt = OrderRow & {
  lines: Array<OrderLineInput & { name: string }>
}

export class OrderError extends Error {
  statusCode: number
  code: string
  items?: MarketItem[]

  constructor(statusCode: number, code: string, message: string, items?: MarketItem[]) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.items = items
  }
}

async function readReceipt(client: PoolClient, id: string): Promise<Receipt> {
  const order = await client.query<OrderRow>(`
    SELECT id, created_at AS "createdAt", total_cents AS "totalCents"
    FROM orders WHERE id = $1
  `, [id])
  const lines = await client.query<Receipt['lines'][number]>(`
    SELECT item_id AS "itemId", name, quantity, unit_price_cents AS "unitPriceCents"
    FROM order_lines WHERE order_id = $1 ORDER BY item_id
  `, [id])
  return { ...order.rows[0], lines: lines.rows }
}

export async function placeOrder(pool: Pool, key: string, input: OrderLineInput[]) {
  const lines = [...input].sort((a, b) => a.itemId - b.itemId)
  const ids = lines.map(line => line.itemId)
  if (new Set(ids).size !== ids.length) {
    throw new OrderError(400, 'DUPLICATE_ITEM', 'Include each product only once.')
  }

  const requestHash = createHash('sha256')
    .update(JSON.stringify(lines.map(line => [line.itemId, line.quantity, line.unitPriceCents])))
    .digest('hex')
  const client = await pool.connect()
  let discardClient = false

  try {
    await client.query('BEGIN')
    const id = randomUUID()
    const reservation = await client.query(`
      INSERT INTO orders (id, idempotency_key, request_hash)
      VALUES ($1, $2, $3) ON CONFLICT (idempotency_key) DO NOTHING
    `, [id, key, requestHash])

    if (!reservation.rowCount) {
      const previous = await client.query<{ id: string; request_hash: string }>(`
        SELECT id, request_hash FROM orders WHERE idempotency_key = $1
      `, [key])
      const order = previous.rows[0]
      if (order.request_hash !== requestHash) {
        throw new OrderError(409, 'IDEMPOTENCY_CONFLICT', 'This request key is already in use.')
      }

      const receipt = await readReceipt(client, order.id)
      await client.query('COMMIT')
      return { receipt, changes: [], replayed: true }
    }

    const { rows: market } = await client.query<MarketRow>(`
      SELECT ${marketColumns}, menu.price_step_cents, menu.max_price_cents
      ${marketFrom}
      WHERE menu.id = ANY($1::integer[])
      ORDER BY menu.id
      FOR UPDATE OF state
    `, [ids])

    if (market.length !== lines.length) {
      throw new OrderError(400, 'UNKNOWN_ITEM', 'An item is unavailable.')
    }

    const changes: MarketItem[] = []
    const items = market.map(({ price_step_cents, max_price_cents, ...item }) => item)
    if (items.some((item, index) => item.priceCents !== lines[index].unitPriceCents)) {
      throw new OrderError(409, 'PRICE_CHANGED', 'Prices changed. Review the new total.', items)
    }

    let totalCents = 0
    for (const [index, line] of lines.entries()) {
      const { price_step_cents, max_price_cents, ...item } = market[index]
      const demand = item.demand + line.quantity
      const priceCents = calculatePriceCents(item.basePriceCents, price_step_cents, max_price_cents, demand)

      await client.query(`
        INSERT INTO order_lines (order_id, item_id, name, quantity, unit_price_cents)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, item.id, item.name, line.quantity, item.priceCents])

      const update = await client.query<Pick<MarketItem, 'priceCents' | 'demand' | 'volume' | 'revision'>>(`
        UPDATE market_state
        SET price_cents = $2, demand = $3, volume = volume + $4, revision = revision + 1
        WHERE item_id = $1
        RETURNING price_cents AS "priceCents", demand, volume, revision
      `, [item.id, priceCents, demand, line.quantity])

      changes.push({ ...item, ...update.rows[0] })
      totalCents += line.quantity * item.priceCents
    }

    await client.query('UPDATE orders SET total_cents = $2 WHERE id = $1', [id, totalCents])
    const receipt = await readReceipt(client, id)
    await client.query('COMMIT')
    return { receipt, changes, replayed: false }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      discardClient = true
    }
    throw error
  } finally {
    client.release(discardClient)
  }
}
