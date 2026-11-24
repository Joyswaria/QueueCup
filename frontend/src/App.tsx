import { useRef, useState } from "react"
import { Routes, Route } from "react-router-dom"
import { submitOrder } from "./marketApi"
import type { CheckoutAttempt, Receipt } from "./marketApi"
import { useMarket } from "./useMarket"
import Home from "./pages/Home"
import Market from "./pages/Market"
import About from "./pages/About"
import Cart from "./pages/Cart"

function App() {
    const market = useMarket()
    const [cart, setCart] = useState<Record<number, number>>({})
    const [attempt, setAttempt] = useState<CheckoutAttempt | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [receipt, setReceipt] = useState<Receipt | null>(null)
    const inFlight = useRef(false)

    const items = market.items.flatMap(item => {
        const quantity = cart[item.id]
        return quantity ? [{ item, quantity }] : []
    })

    function changeQuantity(id: number, change: number) {
        if (inFlight.current || attempt) return
        setCart(current => {
            const quantity = Math.min(99, Math.max(0, (current[id] ?? 0) + change))
            const next = { ...current }
            if (quantity) next[id] = quantity
            else delete next[id]
            return next
        })
        setMessage(null)
        setReceipt(null)
    }

    async function checkout() {
        if (inFlight.current || (!attempt && items.length === 0)) return

        const request = attempt ?? {
            key: crypto.randomUUID(),
            lines: items.map(({ item, quantity }) => ({
                itemId: item.id,
                quantity,
                unitPriceCents: item.priceCents,
            })),
        }

        inFlight.current = true
        setAttempt(request)
        setSubmitting(true)
        setMessage(null)
        try {
            const result = await submitOrder(request, AbortSignal.timeout(15_000))
            if (result.kind === 'receipt') {
                setCart({})
                setReceipt(result.receipt)
            } else {
                if (result.items) market.merge(result.items)
                setMessage(result.message)
            }
            setAttempt(null)
        } catch {
            setMessage('The order result is unknown. Retry to check the same order.')
        } finally {
            inFlight.current = false
            setSubmitting(false)
        }
    }

    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/market" element={
                <Market items={market.items} status={market.status} cart={cart} locked={!!attempt}
                    addToCart={id => changeQuantity(id, 1)} />
            } />
            <Route path="/about" element={<About />} />
            <Route path="/cart" element={
                <Cart items={items} changeQuantity={changeQuantity} checkout={() => void checkout()}
                    submitting={submitting} pendingLines={attempt?.lines} message={message} receipt={receipt} />
            } />
        </Routes>
    )
}

export default App
