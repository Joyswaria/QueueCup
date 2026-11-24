import Fastify from 'fastify'
import type { Pool } from 'pg'
import { getMarket } from './market.ts'
import { createMarketStream } from './market-stream.ts'
import { OrderError, placeOrder } from './orders.ts'
import type { OrderLineInput } from './orders.ts'

const orderSchema = {
  headers: {
    type: 'object',
    required: ['idempotency-key'],
    properties: {
      'idempotency-key': { type: 'string', pattern: '^[A-Za-z0-9_-]{20,128}$' },
    },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['lines'],
    properties: {
      lines: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['itemId', 'quantity', 'unitPriceCents'],
          properties: {
            itemId: { type: 'integer', minimum: 1, maximum: 2_147_483_647 },
            quantity: { type: 'integer', minimum: 1, maximum: 99 },
            unitPriceCents: { type: 'integer', minimum: 1, maximum: 2_147_483_647 },
          },
        },
      },
    },
  },
}

export function buildApp(pool: Pool, logger = false) {
  const app = Fastify({
    logger,
    bodyLimit: 16_384,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  })
  const stream = createMarketStream(pool)

  app.addHook('preClose', async () => stream.close())

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof OrderError) {
      return reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
        items: error.items,
      })
    }

    const httpError = error as { statusCode?: number; message?: string }
    if (httpError.statusCode && httpError.statusCode < 500) {
      return reply.code(httpError.statusCode).send({
        code: 'INVALID_REQUEST',
        message: httpError.message,
      })
    }

    request.log.error({ err: error }, 'Request failed')
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' })
  })

  app.get('/api/ready', async (request, reply) => {
    try {
      await pool.query('SELECT 1 FROM market_state LIMIT 1')
      return { status: 'ready' }
    } catch (error) {
      request.log.warn({ err: error }, 'Database is not ready')
      return reply.code(503).send({ status: 'unavailable' })
    }
  })

  app.get('/api/market', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store')
    return { items: await getMarket(pool) }
  })

  app.get('/api/market/stream', async (_request, reply) => stream.open(reply))

  app.post<{ Body: { lines: OrderLineInput[] }; Headers: { 'idempotency-key': string } }>(
    '/api/orders',
    { schema: orderSchema },
    async (request, reply) => {
      const { receipt, changes, replayed } = await placeOrder(pool, request.headers['idempotency-key'], request.body.lines)
      if (changes.length) stream.publish(changes)
      request.log.info({ orderId: receipt.id, totalCents: receipt.totalCents, replayed }, 'Checkout completed')
      return reply.code(replayed ? 200 : 201).header('Cache-Control', 'no-store').send(receipt)
    },
  )

  return app
}
