export function calculatePriceCents(
  basePriceCents: number,
  priceStepCents: number,
  maxPriceCents: number,
  demand: number,
) {
  return Math.min(maxPriceCents, basePriceCents + demand * priceStepCents)
}
