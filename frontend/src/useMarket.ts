import { useCallback, useEffect, useState } from 'react'
import { fetchMarket } from './marketApi'
import type { MarketItem } from './marketApi'

export function useMarket() {
    const [items, setItems] = useState<MarketItem[]>([])
    const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting')

    const merge = useCallback((updates: MarketItem[]) => {
        setItems(current => {
            const byId = new Map(current.map(item => [item.id, item]))
            for (const update of updates) {
                const previous = byId.get(update.id)
                if (!previous || update.revision > previous.revision) byId.set(update.id, update)
            }
            return [...byId.values()].sort((a, b) => a.id - b.id)
        })
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        let stream: EventSource | undefined
        let retry: ReturnType<typeof setTimeout> | undefined

        function connect() {
            const source = new EventSource('/api/market/stream')
            stream = source
            source.addEventListener('market-snapshot', (event: MessageEvent<string>) => {
                merge(JSON.parse(event.data) as MarketItem[])
                setStatus('live')
            })
            source.addEventListener('market-update', (event: MessageEvent<string>) => {
                merge(JSON.parse(event.data) as MarketItem[])
            })
            source.onerror = () => {
                setStatus('reconnecting')
                // EventSource retries dropped connections itself, but stops after an HTTP error.
                if (source.readyState === EventSource.CLOSED) {
                    retry = setTimeout(connect, 3000)
                }
            }
        }

        connect()
        void fetchMarket(controller.signal)
            .then(result => merge(result.items))
            .catch(() => {
                if (!controller.signal.aborted && stream?.readyState !== EventSource.OPEN) {
                    setStatus('reconnecting')
                }
            })

        return () => {
            controller.abort()
            clearTimeout(retry)
            stream?.close()
        }
    }, [merge])

    return { items, status, merge }
}
