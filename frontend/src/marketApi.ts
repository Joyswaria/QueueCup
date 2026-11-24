export type MarketItem = {
    id: number
    name: string
    description: string
    category: string
    basePriceCents: number
    priceCents: number
    demand: number
    volume: number
    revision: number
}

export type OrderLine = {
    itemId: number
    quantity: number
    unitPriceCents: number
}

export type Receipt = {
    id: string
    createdAt: string
    totalCents: number
    lines: Array<OrderLine & { name: string }>
}

export type CheckoutAttempt = { key: string; lines: OrderLine[] }

const euros = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' })

export function formatPrice(cents: number) {
    return euros.format(cents / 100)
}

export async function fetchMarket(signal: AbortSignal): Promise<{ items: MarketItem[] }> {
    const response = await fetch('/api/market', { signal })
    if (!response.ok) throw new Error('The market is temporarily unavailable.')
    return response.json()
}

export async function submitOrder(attempt: CheckoutAttempt, signal: AbortSignal) {
    const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': attempt.key,
        },
        body: JSON.stringify({ lines: attempt.lines }),
        signal,
    })

    if (response.ok) {
        return { kind: 'receipt' as const, receipt: await response.json() as Receipt }
    }

    if (response.status >= 500 || response.status === 408 || response.status === 429) {
        throw new Error('The checkout result is unavailable.')
    }

    const error = await response.json() as { message: string; items?: MarketItem[] }
    return { kind: 'rejected' as const, message: error.message, items: error.items }
}
