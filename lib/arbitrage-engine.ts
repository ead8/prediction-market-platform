// Arbitrage detection engine for prediction markets
// Uses semantic matching to identify same events across exchanges
// Implements synthetic arbitrage: YES_price1 + NO_price2 < 1.0

import { findSemanticMatches } from './market-matcher'
import { detectCategory } from './category-system'

interface ArbitrageOpportunity {
  id: string
  title: string
  polymarketTitle?: string
  kalshiTitle?: string
  category: string
  buyExchange: 'polymarket' | 'kalshi'
  sellExchange: 'polymarket' | 'kalshi'
  buyPrice: number
  sellPrice: number
  combinedPrice: number
  spreadPercentage: number
  spreadAbsolute: number
  profitMargin: number
  minLiquidity: number
  confidence: 'high' | 'medium' | 'low'
  matchScore: number
  detectedAt: string
  polymarketId?: string
  kalshiId?: string
  commonEntities: string[]
}

interface MarketPrice {
  id: string
  source: 'polymarket' | 'kalshi'
  title: string
  category: string
  yesPrice: number
  noPrice: number
  liquidity: number
  volume24h: number
}

export function detectArbitrageOpportunities(
  polymarketMarkets: MarketPrice[],
  kalshiMarkets: MarketPrice[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = []

  console.log(`[arb-engine] Starting semantic matching: ${polymarketMarkets.length} Polymarket vs ${kalshiMarkets.length} Kalshi`)

  if (kalshiMarkets.length === 0) {
    console.log('[arb-engine] No Kalshi markets to compare')
    return []
  }

  // Use semantic matching instead of fuzzy string matching
  const matches = findSemanticMatches(polymarketMarkets, kalshiMarkets, 0.2)
  console.log(`[arb-engine] Found ${matches.length} semantically matched market pairs`)

  let syntheticArbs = 0
  let tooHighCombined = 0
  let lowSimilarity = 0

  for (const match of matches) {
    const poly = match.polymarket as MarketPrice
    const kalshi = match.kalshi as MarketPrice
    const similarity = match.similarity

    // Skip if similarity too low
    if (similarity < 0.2) {
      lowSimilarity++
      continue
    }

    // Detect synthetic arbitrage: YES_price + NO_price < 1.0
    // This means you can buy YES on one exchange and NO on the other for profit
    const polyToKalshiYes = poly.yesPrice + kalshi.noPrice
    const polyToKalshiNo = poly.noPrice + kalshi.yesPrice
    const kalshiToPolyYes = kalshi.yesPrice + poly.noPrice
    const kalshiToPolyNo = kalshi.noPrice + poly.yesPrice

    const minCombined = Math.min(polyToKalshiYes, polyToKalshiNo, kalshiToPolyYes, kalshiToPolyNo)
    const spreadPerc = (1.0 - minCombined) * 100

    // Must have arbitrage spread and reasonable prices
    if (minCombined >= 0.99 || spreadPerc < 1) {
      tooHighCombined++
      continue
    }

    syntheticArbs++

    // Determine best arbitrage strategy
    let bestStrat = null
    let bestSpread = 0
    let buyExch = ''
    let sellExch = ''
    let buyPrice = 0
    let sellPrice = 0

    if (polyToKalshiYes < minCombined) {
      minCombined = polyToKalshiYes
      bestStrat = 'poly_yes_kalshi_no'
      buyExch = 'polymarket'
      sellExch = 'kalshi'
      buyPrice = poly.yesPrice
      sellPrice = kalshi.noPrice
    }
    if (polyToKalshiNo < minCombined) {
      minCombined = polyToKalshiNo
      bestStrat = 'poly_no_kalshi_yes'
      buyExch = 'polymarket'
      sellExch = 'kalshi'
      buyPrice = poly.noPrice
      sellPrice = kalshi.yesPrice
    }
    if (kalshiToPolyYes < minCombined) {
      minCombined = kalshiToPolyYes
      bestStrat = 'kalshi_yes_poly_no'
      buyExch = 'kalshi'
      sellExch = 'polymarket'
      buyPrice = kalshi.yesPrice
      sellPrice = poly.noPrice
    }
    if (kalshiToPolyNo < minCombined) {
      minCombined = kalshiToPolyNo
      bestStrat = 'kalshi_no_poly_yes'
      buyExch = 'kalshi'
      sellExch = 'polymarket'
      buyPrice = kalshi.noPrice
      sellPrice = poly.yesPrice
    }

    if (bestStrat && minCombined < 0.99) {
      const profitPerc = (1.0 - minCombined) * 100
      const category = detectCategory(poly.title)
      const minLiq = Math.min(poly.liquidity, kalshi.liquidity)

      opportunities.push({
        id: `arb_synthetic_${poly.id}_${kalshi.id}`,
        title: poly.title,
        polymarketTitle: poly.title,
        kalshiTitle: kalshi.title,
        category,
        buyExchange: buyExch as 'polymarket' | 'kalshi',
        sellExchange: sellExch as 'polymarket' | 'kalshi',
        buyPrice,
        sellPrice,
        combinedPrice: minCombined,
        spreadPercentage: profitPerc,
        spreadAbsolute: 1.0 - minCombined,
        profitMargin: Math.max(0, profitPerc - 0.5), // Account for ~0.5% fees
        minLiquidity: minLiq,
        matchScore: similarity,
        confidence: profitPerc > 5 ? 'high' : profitPerc > 2 ? 'medium' : 'low',
        detectedAt: new Date().toISOString(),
        polymarketId: poly.id,
        kalshiId: kalshi.id,
        commonEntities: match.commonEntities,
      })
    }
  }

  console.log(`[arb-engine] Summary: ${syntheticArbs} synthetic arbitrage opportunities, ${tooHighCombined} too expensive, ${lowSimilarity} low similarity`)

  // Sort by profit margin (highest first)
  return opportunities.sort((a, b) => b.profitMargin - a.profitMargin)
}

export function filterArbitrageByConfidence(
  opportunities: ArbitrageOpportunity[],
  minConfidenceSpread: number = 2
): ArbitrageOpportunity[] {
  return opportunities.filter((opp) => opp.spreadPercentage >= minConfidenceSpread)
}
