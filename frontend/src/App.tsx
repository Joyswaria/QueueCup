import { Routes, Route } from "react-router-dom"
import { useState } from "react"
import type { Produit } from "./types/MenuItems"

import Home from "./pages/Home"
import Market from "./pages/Market"
import About from "./pages/About"
import Cart from "./pages/Cart"

function App() {
    const [cart, setCart] = useState<Produit[]>([])

    function addToCart( prod : Produit) {
        setCart([...cart, prod])
    }

    return (
    <>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/market" element={<Market addToCart={addToCart} />} />
            <Route path="/about" element={<About />} />
            <Route path="/cart" element={<Cart cart={cart}/>} />
        </Routes>
    </>
    )
}

export default App