import type { Produit } from "../types/MenuItems"

export type MenuCardProps = {
    item: Produit
    addToCart: (produit: Produit) => void
}

function MenuCard({ item, addToCart } : MenuCardProps) {    
    return (
        <>
            <li className="menu-card">
                <h2>{item.name}</h2>
                <p><strong>{item.description}</strong></p>
                <p>Category : {item.category}</p>
                <p className="price">Price : {item.currentPrice} €</p>
                <p>Demand : {item.demand}</p>
                <p>Volume : {item.volume}</p>

                <button 
                    className="addtocart-button"
                    onClick={() => addToCart(item)}
                >
                    Add to cart
                </button>
            </li>

            
        </>
    )
}

export default MenuCard