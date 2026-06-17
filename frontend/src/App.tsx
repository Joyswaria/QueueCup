import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Market from "./pages/Market"
import About from "./pages/About"

function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/market" element={<Market />} />
            <Route path="/about" element={<About />} />
        </Routes>
    )
}

export default App