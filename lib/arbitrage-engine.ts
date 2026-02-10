// Arbitrage detection engine for prediction markets
// Detects profitable opportunities across Polymarket and Kalshi

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
  spreadPercentage: number
  spreadAbsolute: number
  profitMargin: number
  minLiquidity: number
  confidence: 'high' | 'medium' | 'low'
  matchScore: number
  detectedAt: string
  polymarketId?: string
  kalshiId?: string
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

// Extract key terms from market titles for matching
function extractKeyTerms(title: string): Set<string> {
  const terms = title.toLowerCase().split(/\s+/)
  const keywords = terms
    .filter((t) => t.length > 3) // Only words longer than 3 chars
    .map((t) => t.replace(/[^\w]/g, '')) // Remove special chars
    .filter((t) => !['will', 'the', 'and', 'year', 'before'].includes(t))
  return new Set(keywords)
}

// Calculate similarity between two market titles (Jaccard similarity)
function calculateTitleSimilarity(title1: string, title2: string): number {
  const terms1 = extractKeyTerms(title1)
  const terms2 = extractKeyTerms(title2)

  if (terms1.size === 0 || terms2.size === 0) return 0

  const intersection = new Set([...terms1].filter((x) => terms2.has(x)))
  const union = new Set([...terms1, ...terms2])

  return intersection.size / union.size
}

// Fuzzy string matching for word boundaries
function fuzzyMatch(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  // Check for exact substring match
  if (s1.includes(s2) || s2.includes(s1)) return 0.9

  // Levenshtein-like distance (simplified)
  let matches = 0
  const shorter = s1.length < s2.length ? s1 : s2
  const longer = s1.length >= s2.length ? s1 : s2

  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter.charAt(i))) {
      matches++
    }
  }

  return matches / longer.length
}

// Find best match for a market across exchanges
function findBestMatch(market: MarketPrice, otherMarkets: MarketPrice[]): { match: MarketPrice | null; score: number } {
  let bestMatch: MarketPrice | null = null
  let bestScore = 0

  for (const other of otherMarkets) {
    // Combine similarity scores
    const jaccard = calculateTitleSimilarity(market.title, other.title)
    const fuzzy = fuzzyMatch(market.title, other.title)
    const categoryMatch = market.category === other.category ? 0.2 : 0

    const combinedScore = jaccard * 0.5 + fuzzy * 0.3 + categoryMatch

    if (combinedScore > bestScore) {
      bestScore = combinedScore
      bestMatch = other
    }
  }

  // Only return matches with reasonable confidence (>0.3)
  return bestScore > 0.3 ? { match: bestMatch, score: bestScore } : { match: null, score: 0 }
}

export function detectArbitrageOpportunities(
  polymarketMarkets: MarketPrice[],
  kalshiMarkets: MarketPrice[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = []

  console.log(`[arb-engine] Starting match: ${polymarketMarkets.length} Polymarket vs ${kalshiMarkets.length} Kalshi`)

  if (kalshiMarkets.length === 0) {
    console.log('[arb-engine] No Kalshi markets to compare')
    return []
  }

  // First try exact title matches
  const kalshiMap = new Map(kalshiMarkets.map((m) => [m.title.toLowerCase(), m]))

  // Track already matched markets to avoid duplicates
  const matchedKalshi = new Set<string>()
  let exactMatches = 0
  let fuzzyMatches = 0
  let skippedLowScore = 0
  let skippedLowSpread = 0
  let skippedLowLiquidity = 0

  for (const poly of polymarketMarkets) {
    let kalshi = kalshiMap.get(poly.title.toLowerCase())
    let matchType = 'exact'

    // If no exact match, find best fuzzy match
    if (!kalshi) {
      const remainingKalshi = kalshiMarkets.filter(
        (m) => !matchedKalshi.has(m.id)
      )
      const { match, score } = findBestMatch(poly, remainingKalshi)
      kalshi = match
      matchType = 'fuzzy'
      if (!kalshi || score < 0.4) continue
    }

    if (matchType === 'exact') exactMatches++
    else fuzzyMatches++

    matchedKalshi.add(kalshi.id)

    // Calculate match score
    const matchScore = calculateTitleSimilarity(poly.title, kalshi.title)

    // Only proceed if confidence is reasonable
    if (matchScore < 0.25) {
      skippedLowScore++
      continue
    }

    // Calculate spreads for YES and NO outcomes
    const yesSpread = Math.abs(poly.yesPrice - kalshi.yesPrice)
    const noSpread = Math.abs(poly.noPrice - kalshi.noPrice)

    // Log first few matches for debugging
    if (exactMatches + fuzzyMatches <= 3) {
      console.log(`[arb-engine] Match (${matchType}): "${poly.title.substring(0, 40)}" <-> "${kalshi.title.substring(0, 40)}" | poly=${poly.yesPrice.toFixed(3)}/${poly.noPrice.toFixed(3)} kalshi=${kalshi.yesPrice.toFixed(3)}/${kalshi.noPrice.toFixed(3)} | spread=${yesSpread.toFixed(3)}/${noSpread.toFixed(3)} | liq=${poly.liquidity}/${kalshi.liquidity}`)
    }

    // Check for YES arbitrage (buy on one, sell on other)
    if (poly.yesPrice < kalshi.yesPrice && yesSpread > 0.01) {
      const spreadPerc = ((kalshi.yesPrice - poly.yesPrice) / poly.yesPrice) * 100
      const minLiq = Math.min(poly.liquidity, kalshi.liquidity)

      if (spreadPerc > 2 && minLiq >= 0) {
        // Allow zero liquidity for now since Kalshi liquidity may not be available
        // Lowered liquidity threshold to allow more matches
        opportunities.push({
          id: `arb_poly_kalshi_yes_${poly.id}`,
          title: `${poly.title} (YES)`,
          polymarketTitle: poly.title,
          kalshiTitle: kalshi.title,
          category: poly.category || kalshi.category,
          buyExchange: 'polymarket',
          sellExchange: 'kalshi',
          buyPrice: poly.yesPrice,
          sellPrice: kalshi.yesPrice,
          spreadPercentage: spreadPerc,
          spreadAbsolute: yesSpread,
          profitMargin: Math.max(0, spreadPerc - 1), // Account for ~1% fees
          minLiquidity: minLiq,
          matchScore,
          confidence: spreadPerc > 5 ? 'high' : spreadPerc > 3 ? 'medium' : 'low',
          detectedAt: new Date().toISOString(),
          polymarketId: poly.id,
          kalshiId: kalshi.id,
        })
      }
    } else if (kalshi.yesPrice < poly.yesPrice && yesSpread > 0.01) {
      const spreadPerc = ((poly.yesPrice - kalshi.yesPrice) / kalshi.yesPrice) * 100
      const minLiq = Math.min(poly.liquidity, kalshi.liquidity)

      if (spreadPerc > 2) {
        opportunities.push({
          id: `arb_kalshi_poly_yes_${kalshi.id}`,
          title: `${poly.title} (YES)`,
          polymarketTitle: poly.title,
          kalshiTitle: kalshi.title,
          category: poly.category || kalshi.category,
          buyExchange: 'kalshi',
          sellExchange: 'polymarket',
          buyPrice: kalshi.yesPrice,
          sellPrice: poly.yesPrice,
          spreadPercentage: spreadPerc,
          spreadAbsolute: yesSpread,
          profitMargin: Math.max(0, spreadPerc - 1),
          minLiquidity: minLiq,
          matchScore,
          confidence: spreadPerc > 5 ? 'high' : spreadPerc > 3 ? 'medium' : 'low',
          detectedAt: new Date().toISOString(),
          polymarketId: poly.id,
          kalshiId: kalshi.id,
        })
      }
    }

    // Check for NO arbitrage
    if (poly.noPrice < kalshi.noPrice && noSpread > 0.01) {
      const spreadPerc = ((kalshi.noPrice - poly.noPrice) / poly.noPrice) * 100
      const minLiq = Math.min(poly.liquidity, kalshi.liquidity)

      if (spreadPerc > 2) {
        opportunities.push({
          id: `arb_poly_kalshi_no_${poly.id}`,
          title: `${poly.title} (NO)`,
          polymarketTitle: poly.title,
          kalshiTitle: kalshi.title,
          category: poly.category || kalshi.category,
          buyExchange: 'polymarket',
          sellExchange: 'kalshi',
          buyPrice: poly.noPrice,
          sellPrice: kalshi.noPrice,
          spreadPercentage: spreadPerc,
          spreadAbsolute: noSpread,
          profitMargin: Math.max(0, spreadPerc - 1),
          minLiquidity: minLiq,
          matchScore,
          confidence: spreadPerc > 5 ? 'high' : spreadPerc > 3 ? 'medium' : 'low',
          detectedAt: new Date().toISOString(),
          polymarketId: poly.id,
          kalshiId: kalshi.id,
        })
      }
    } else if (kalshi.noPrice < poly.noPrice && noSpread > 0.01) {
      const spreadPerc = ((poly.noPrice - kalshi.noPrice) / kalshi.noPrice) * 100
      const minLiq = Math.min(poly.liquidity, kalshi.liquidity)

      if (spreadPerc > 2) {
        opportunities.push({
          id: `arb_kalshi_poly_no_${kalshi.id}`,
          title: `${poly.title} (NO)`,
          polymarketTitle: poly.title,
          kalshiTitle: kalshi.title,
          category: poly.category || kalshi.category,
          buyExchange: 'kalshi',
          sellExchange: 'polymarket',
          buyPrice: kalshi.noPrice,
          sellPrice: poly.noPrice,
          spreadPercentage: spreadPerc,
          spreadAbsolute: noSpread,
          profitMargin: Math.max(0, spreadPerc - 1),
          minLiquidity: minLiq,
          matchScore,
          confidence: spreadPerc > 5 ? 'high' : spreadPerc > 3 ? 'medium' : 'low',
          detectedAt: new Date().toISOString(),
          polymarketId: poly.id,
          kalshiId: kalshi.id,
        })
      }
    }
  }

  console.log(`[arb-engine] Summary: ${exactMatches} exact + ${fuzzyMatches} fuzzy matches, ${skippedLowScore} low-score skips, ${opportunities.length} opportunities found`)

  // Sort by profit margin (highest first)
  return opportunities.sort((a, b) => b.profitMargin - a.profitMargin)
}

export function filterArbitrageByConfidence(
  opportunities: ArbitrageOpportunity[],
  minConfidenceSpread: number = 2
): ArbitrageOpportunity[] {
  return opportunities.filter((opp) => opp.spreadPercentage >= minConfidenceSpread)
}
