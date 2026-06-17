import Navbar from "../components/Navbar"
import { menuItems } from "../data/menuItems"

function Market() {
  return (
    <>
      <Navbar />

      <main>
        <h1>Live Café Market</h1>
        <p>Menu items will be displayed here.</p>

        <ul>
            {menuItems.map((item) => (
                <li key={item.id}>
                    <h2>{item.name}</h2>
                    <p><strong>{item.description}</strong></p>
                    <p>{item.category}</p>
                    <p>{item.currentPrice}</p>
                    <p>{item.demand}</p>
                    <p>{item.volume}</p>
                </li>
            ))}
        </ul>

      </main>
    </>
  )
}

export default Market