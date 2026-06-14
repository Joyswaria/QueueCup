import { Link } from "react-router-dom"

function Navbar() {
    return (
        <nav className="navbar">
            <h2 className="logo">QueueCup</h2>

            <div className="links">
                <Link to="/">Home</Link>
                <Link to="/reservation">Reservation</Link>
                <Link to="/about">About</Link>
            </div>
        </nav>
    )
}

export default Navbar