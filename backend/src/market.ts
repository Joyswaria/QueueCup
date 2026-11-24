import type { Pool } from 'pg'

export type MarketItem = {
  id: number
  name: string
  description: string
  category: string
  basePriceCents: number
  priceCents: number
  demand: number
  volume: number
  revision: number
}

export type MarketRow = MarketItem & {
  price_step_cents: number
  max_price_cents: number
}

export const marketColumns = `
  menu.id, menu.name, menu.description, menu.category,
    menu.base_price_cents AS "basePriceCents", state.price_cents AS "priceCents",
    state.demand, state.volume, state.revision
`

export const marketFrom = `
  FROM menu_items AS menu
  JOIN market_state AS state ON state.item_id = menu.id
`

export async function getMarket(pool: Pool) {
  const result = await pool.query<MarketItem>(`
    SELECT ${marketColumns} ${marketFrom} ORDER BY menu.id
  `)
  return result.rows
}
