import { Link } from "react-router-dom"

function Navbar() {
    return (
        <nav>
            <div className="nav-links">
                <Link to="/">Home</Link>
                <Link to="/market">Market</Link>
                <Link to="/about">About</Link>
                <Link to="/cart">Cart</Link>
            </div>
        </nav>
    )
}

export default Navbar