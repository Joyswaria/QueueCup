import Navbar from "../components/Navbar"
import { menuItems } from "../data/menuItems"
import MenuCard from "../components/MenuCard"

function Market() {
  return (
    <>
      <Navbar />

      <main>
        <h1>Live Café Market</h1>
        <p>Menu items will be displayed here.</p>

        <ul className="menu-list">
            {menuItems.map((item) => (
                <MenuCard key={item.id} item={item} />
            ))}
        </ul>

      </main>
    </>
  )
}

export default Market