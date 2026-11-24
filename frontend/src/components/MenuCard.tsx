import { formatPrice } from "../marketApi"
import type { MarketItem } from "../marketApi"

export type MenuCardProps = {
    item: MarketItem
    addToCart: (itemId: number) => void
    canAdd: boolean
}

function MenuCard({ item, addToCart, canAdd }: MenuCardProps) {
    return (
        <>
            <li className="menu-card">
                <h2>{item.name}</h2>
                <p><strong>{item.description}</strong></p>
                <p>Category : {item.category}</p>
                <p className="price">Price {formatPrice(item.priceCents)}</p>
                <p>Demand : {item.demand}</p>
                <p>Volume : {item.volume}</p>

                <button 
                    className="addtocart-button"
                    onClick={() => addToCart(item.id)}
                    disabled={!canAdd}
                >
                    Add to cart
                </button>
            </li>

            
        </>
    )
}

export default MenuCard
