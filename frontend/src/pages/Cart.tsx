import { Link } from "react-router-dom"
import Navbar from "../components/Navbar"
import { formatPrice } from "../marketApi"
import type { MarketItem, OrderLine, Receipt } from "../marketApi"

type CartProps = {
    items: Array<{ item: MarketItem; quantity: number }>
    changeQuantity: (id: number, change: number) => void
    checkout: () => void
    submitting: boolean
    pendingLines: OrderLine[] | undefined
    message: string | null
    receipt: Receipt | null
}

function Cart({ items, changeQuantity, checkout, submitting, pendingLines, message, receipt }: CartProps) {
    const displayedItems = items.map(({ item, quantity }) => ({
        item,
        quantity,
        unitPriceCents: pendingLines?.find(line => line.itemId === item.id)?.unitPriceCents ?? item.priceCents,
    }))
    const total = displayedItems.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)

    return (
        <>
            <Navbar />
            <main className="cart-page">
                <h1>Cart</h1>
                {message && <p role="alert">{message}</p>}
                {items.length > 0 && (
                    <>
                        <ul className="cart-list">
                            {displayedItems.map(({ item, quantity, unitPriceCents }) => (
                                <li key={item.id}>
                                    <span>{item.name} · {formatPrice(unitPriceCents)} each</span>
                                    <span className="quantity-controls">
                                        <button
                                            type="button"
                                            aria-label={`Remove one ${item.name}`}
                                            onClick={() => changeQuantity(item.id, -1)}
                                            disabled={!!pendingLines}
                                        >−</button>
                                        <span>{quantity}</span>
                                        <button
                                            type="button"
                                            aria-label={`Add one ${item.name}`}
                                            onClick={() => changeQuantity(item.id, 1)}
                                            disabled={!!pendingLines || quantity >= 99}
                                        >+</button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p><strong>{pendingLines ? 'Submitted total' : 'Current total'} {formatPrice(total)}</strong></p>
                    </>
                )}
                {(items.length > 0 || pendingLines) && (
                    <button className="checkout-button" type="button" disabled={submitting} onClick={checkout}>
                        {submitting ? 'Placing order…' : pendingLines ? 'Retry checkout' : 'Place simulated order'}
                    </button>
                )}
                {!items.length && !receipt && !pendingLines && (
                    <p>Your cart is empty. <Link to="/market">Browse the market</Link>.</p>
                )}
                {receipt && (
                    <section className="receipt" aria-labelledby="receipt-heading" role="status">
                        <h2 id="receipt-heading">Order confirmed</h2>
                        <ul className="cart-list">
                            {receipt.lines.map(line => (
                                <li key={line.itemId}>
                                    <span>{line.quantity} × {line.name}</span>
                                    <span>{formatPrice(line.quantity * line.unitPriceCents)}</span>
                                </li>
                            ))}
                        </ul>
                        <p><strong>Order total {formatPrice(receipt.totalCents)}</strong></p>
                        <p className="receipt-id">Order {receipt.id}</p>
                    </section>
                )}
            </main>
        </>
    )
}

export default Cart
