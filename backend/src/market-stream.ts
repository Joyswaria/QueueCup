import type { FastifyReply } from 'fastify'
import type { Pool } from 'pg'
import { getMarket } from './market.ts'
import type { MarketItem } from './market.ts'

type Subscriber = {
  update: (items: MarketItem[]) => void
  close: () => void
}

export function createMarketStream(pool: Pool) {
  const subscribers = new Set<Subscriber>()

  async function open(reply: FastifyReply) {
    const response = reply.raw
    const pending = new Map<number, MarketItem>()
    let ready = false
    let heartbeat: ReturnType<typeof setInterval> | undefined

    function write(frame: string) {
      if (!response.destroyed && !response.write(frame)) {
        response.destroy()
      }
    }

    function send(event: string, items: MarketItem[]) {
      write(`event: ${event}\ndata: ${JSON.stringify(items)}\n\n`)
    }

    const subscriber: Subscriber = {
      update(items) {
        if (ready) {
          send('market-update', items)
        } else {
          for (const item of items) {
            const previous = pending.get(item.id)
            if (!previous || item.revision > previous.revision) pending.set(item.id, item)
          }
        }
      },
      close() {
        response.destroy()
      },
    }

    function unsubscribe() {
      clearInterval(heartbeat)
      subscribers.delete(subscriber)
    }

    // Subscribe before reading the snapshot so a concurrent checkout cannot fall in a gap.
    subscribers.add(subscriber)
    response.once('close', unsubscribe)
    let snapshot: MarketItem[]
    try {
      snapshot = await getMarket(pool)
    } catch (error) {
      unsubscribe()
      throw error
    }
    if (response.destroyed) return reply

    reply.hijack()
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    })
    send('market-snapshot', snapshot)

    const updates = snapshot.flatMap(item => {
      const update = pending.get(item.id)
      return update && update.revision > item.revision ? [update] : []
    })
    pending.clear()
    ready = true
    if (updates.length) send('market-update', updates)

    if (!response.destroyed) {
      heartbeat = setInterval(() => write(': heartbeat\n\n'), 15_000)
      heartbeat.unref()
    }
    return reply
  }

  return {
    open,
    publish(items: MarketItem[]) {
      for (const subscriber of subscribers) subscriber.update(items)
    },
    close() {
      for (const subscriber of subscribers) subscriber.close()
    },
  }
}
