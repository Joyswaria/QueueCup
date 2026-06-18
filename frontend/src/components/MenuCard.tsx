import type { Produit } from "../types/MenuItems"

export type MenuCardProps = {
    item: Produit
}

function MenuCard({ item } : MenuCardProps) {
    return (
        <li className="menu-card">
            <h2>{item.name}</h2>
            <p><strong>{item.description}</strong></p>
            <p>Category : {item.category}</p>
            <p className="price">Price : {item.currentPrice} €</p>
            <p>Demand : {item.demand}</p>
            <p>Volume : {item.volume}</p>
        </li>
    )
}

export default MenuCard