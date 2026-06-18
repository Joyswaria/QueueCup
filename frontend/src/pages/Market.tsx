import Navbar from "../components/Navbar"
import { menuItems } from "../data/menuItems"
import MenuCard from "../components/MenuCard"
import type { Produit } from "../types/MenuItems"

export type MarketProps = {
    addToCart : (prod : Produit) => void
}

function Market({ addToCart } : MarketProps) {
  return (
    <>
      <Navbar />

      <main>
        <h1>Café Market</h1>
        <p>Menu items are displayed here.</p>

        <ul className="menu-list">
            {menuItems.map((item) => (
                <MenuCard key={item.id} item={item} addToCart={addToCart} />
            ))}
        </ul>

      </main>
    </>
  )
}

export default Market