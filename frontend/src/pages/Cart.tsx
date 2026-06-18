import Navbar from "../components/Navbar"
import type { Produit } from "../types/MenuItems"

export type CartProps = {
    cart: Produit[]
}

function Cart({ cart } : CartProps) {
    return (
    <>
        <Navbar />
            <main>
                <p>Your cart : selected items will appear here.</p>
                <p>Cart items: {cart.length}</p>

                <ul>
                    {cart.map((item, index) => (
                        <li key={index}>
                            {item.name} - {item.currentPrice.toFixed(2)} €
                        </li>
                    ))}
                </ul>

            </main>
    </>
    )
}

export default Cart