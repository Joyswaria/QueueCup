import Navbar from "../components/Navbar"
import MenuCard from "../components/MenuCard"
import type { MarketItem } from "../marketApi"

type MarketProps = {
    items: MarketItem[]
    status: 'connecting' | 'live' | 'reconnecting'
    cart: Record<number, number>
    locked: boolean
    addToCart: (itemId: number) => void
}

function Market({ items, status, cart, locked, addToCart }: MarketProps) {
    return (
        <>
            <Navbar />
            <main>
                <h1>Café Market</h1>
                {status !== 'live' && (
                    <p role="status">
                        {status === 'connecting' ? 'Connecting to the market…' : 'Reconnecting to the market…'}
                    </p>
                )}
                <ul className="menu-list">
                    {items.map(item => (
                        <MenuCard
                            key={item.id}
                            item={item}
                            addToCart={addToCart}
                            canAdd={!locked && (cart[item.id] ?? 0) < 99}
                        />
                    ))}
                </ul>
            </main>
        </>
    )
}

export default Market
