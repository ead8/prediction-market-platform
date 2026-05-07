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
  // True when the Kalshi side has live bid+ask but the public API hides the
  // dollar depth — the spread is real but quantifiable depth is unknown.
  liquidityUnknown?: boolean
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
  // Kalshi-only: true when both bid and ask are quoted. The public API hides
  // dollar liquidity, so we use this as a fallback "is there a market to
  // trade against" signal.
  tradeable?: boolean
}

// Words that show up in nearly every prediction-market question and therefore
// carry no signal that two markets are about the same thing.
const STOPWORDS = new Set([
  'will', 'the', 'and', 'for', 'with', 'this', 'that', 'before', 'after',
  'year', 'month', 'week', 'day', 'date', 'next', 'last', 'first', 'second',
  'third', 'fourth', 'be', 'is', 'are', 'was', 'were', 'have', 'has', 'had',
  'win', 'wins', 'won', 'lose', 'loses', 'beat', 'beats', 'reach', 'reaches',
  'hit', 'hits', 'close', 'closes', 'closed', 'open', 'opens', 'opened',
  'between', 'over', 'under', 'above', 'below', 'than', 'more', 'less',
  'most', 'least', 'highest', 'lowest', 'best', 'worst', 'any', 'all',
  'who', 'what', 'which', 'when', 'where', 'how',
  'each', 'every', 'either', 'neither', 'their', 'there',
])

// Extract content terms (length >= 4, not a stopword) from a title.
function extractKeyTerms(title: string): Set<string> {
  const out = new Set<string>()
  for (const raw of title.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || raw.length < 4) continue
    if (STOPWORDS.has(raw)) continue
    out.add(raw)
  }
  return out
}

// "Weak" topic words appear in a huge fraction of prediction-market titles.
// They're capitalized but they don't identify which question is being asked
// (e.g., "Democratic", "Republican", "Presidential" appear in every 2028
// election market on both exchanges). Sharing only weak terms is not enough.
const WEAK_TOPIC_TERMS = new Set([
  'democratic', 'republican', 'democrat', 'republicans', 'democrats',
  'presidential', 'president', 'primary', 'primaries', 'nominee', 'nomination',
  'election', 'elections', 'vote', 'voting', 'voter', 'voters',
  'gop', 'us', 'usa', 'united', 'states', 'congress', 'senate', 'governor',
  'world', 'national', 'international', 'global',
  'cup', 'finals', 'championship', 'champions', 'season', 'game', 'match',
  'price', 'prices', 'high', 'low', 'over', 'under', 'between',
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'january', 'february', 'march', 'april', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
])

// Topic terms split into:
//   - identity: a *name* of a person/place/thing/ticker. The actual subject
//     of the question (e.g., "Pence", "Bitcoin", "Putin"). Two markets must
//     share at least one identity term to be considered the same question.
//   - support:  years and dollar amounts. Useful tie-breakers but NOT enough
//     on their own — every 2028 election market has "2028".
//   - weak:     generic descriptors ("Democratic", "Presidential"). Ignored.
function extractTopicTerms(title: string): {
  identity: Set<string>
  support: Set<string>
  weak: Set<string>
} {
  const identity = new Set<string>()
  const support = new Set<string>()
  const weak = new Set<string>()
  const capRe = /\b[A-Z][A-Za-z0-9]{2,}\b/g
  let m: RegExpExecArray | null
  while ((m = capRe.exec(title)) !== null) {
    const word = m[0].toLowerCase()
    if (STOPWORDS.has(word)) continue
    if (word === 'yes' || word === 'no' || word === 'and') continue
    if (WEAK_TOPIC_TERMS.has(word)) {
      weak.add(word)
    } else {
      identity.add(word)
    }
  }
  // Years and dollar amounts → support, not identity.
  const yearRe = /\b(19|20)\d{2}\b/g
  while ((m = yearRe.exec(title)) !== null) support.add(m[0])
  const dollarRe = /\$([\d,]+)(?:k|m|b)?/gi
  while ((m = dollarRe.exec(title)) !== null) support.add(m[0].toLowerCase())
  return { identity, support, weak }
}

// Jaccard over content terms.
function calculateTitleSimilarity(title1: string, title2: string): number {
  const a = extractKeyTerms(title1)
  const b = extractKeyTerms(title2)
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

function sharedSetCount(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const t of a) if (b.has(t)) n++
  return n
}

// Predicate buckets: the *verb* of a prediction-market question is what's
// being asked. Two markets can share the same subject ("Wes Moore") but ask
// different things ("win" vs "declare for"). If two titles fall into
// different predicate buckets, they are NOT the same question.
const PREDICATE_BUCKETS: Record<string, RegExp> = {
  win: /\b(win|wins|won|winning|winner)\b/i,
  declare: /\b(declare|declares|declared|announce|announces|announced|run\s+for|launch\s+a\s+campaign)\b/i,
  defeat: /\b(defeat|defeats|defeated|beat|beats|beaten)\b/i,
  reach: /\b(hit|hits|reach|reaches|close\s+above|exceed|exceeds|surpass)\b/i,
  appoint: /\b(appoint|appointed|nominate|nominated|confirm|confirmed)\b/i,
  resign: /\b(resign|resigns|resigned|step\s+down|impeach|impeached|out\s+as)\b/i,
}

function predicateBuckets(title: string): Set<string> {
  const out = new Set<string>()
  for (const [name, re] of Object.entries(PREDICATE_BUCKETS)) {
    if (re.test(title)) out.add(name)
  }
  return out
}

// Two markets are predicate-compatible if either:
//   - they hit the same predicate bucket (both "win", both "reach", etc.)
//   - neither has any predicate bucket marked (generic phrasing on both sides)
function predicatesCompatible(a: string, b: string): boolean {
  const ba = predicateBuckets(a)
  const bb = predicateBuckets(b)
  if (ba.size === 0 && bb.size === 0) return true
  for (const t of ba) if (bb.has(t)) return true
  return false
}

// Precomputed term sets so an N×M cross-exchange scan stays cheap.
interface IndexedMarket {
  market: MarketPrice
  cat: string
  contentTerms: Set<string>
  identity: Set<string>
  support: Set<string>
  predicates: Set<string>
  title: string
}

function indexMarket(m: MarketPrice): IndexedMarket {
  const { identity, support } = extractTopicTerms(m.title)
  return {
    market: m,
    cat: (m.category || '').toLowerCase(),
    contentTerms: extractKeyTerms(m.title),
    identity,
    support,
    predicates: predicateBuckets(m.title),
    title: m.title,
  }
}

function indexMarkets(markets: MarketPrice[]): IndexedMarket[] {
  return markets.map(indexMarket)
}

function jaccardOf(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

// Find best Polymarket↔Kalshi pair. Strict cross-exchange identity check:
//   - Same category bucket
//   - At least one shared IDENTITY term
//   - "Identity containment" ≥ 0.6 — most of the identity terms in the larger
//     side must also appear on the smaller side. This rules out matches like
//     "Will Marco Rubio win" {marco, rubio} × "Will Marco Rubio AND JD Vance
//     be the ticket" {marco, rubio, jd, vance}: 2/4 = 0.5, fails.
//   - Reasonable content-term Jaccard (≥ 0.3)
function findBestMatchIndexed(
  poly: IndexedMarket,
  kalshi: IndexedMarket[],
): { match: MarketPrice | null; score: number } {
  let bestMatch: MarketPrice | null = null
  let bestScore = 0

  for (const other of kalshi) {
    if (!poly.cat || !other.cat || poly.cat !== other.cat) continue

    const sharedIdentity = sharedSetCount(poly.identity, other.identity)
    if (sharedIdentity < 1) continue

    // Two-sided containment: most of the identity terms on EACH side must
    // overlap. Catches cases where one side has extra names (combo market):
    //   {marco, rubio} × {marco, rubio}                 → 1.0 / 1.0  ✓
    //   {marco, rubio} × {marco, rubio, jd, vance}      → 1.0 / 0.5  ✗
    //   {wes, moore}   × {wes, moore}                   → 1.0 / 1.0  ✓
    const polyContainment = sharedIdentity / Math.max(poly.identity.size, 1)
    const otherContainment = sharedIdentity / Math.max(other.identity.size, 1)
    if (polyContainment < 0.75 || otherContainment < 0.75) continue

    // Predicate alignment: both must ask the same kind of question.
    // ("Wes Moore win" vs "Wes Moore declare" → reject.)
    let predOk = false
    if (poly.predicates.size === 0 && other.predicates.size === 0) {
      predOk = true
    } else {
      for (const p of poly.predicates) if (other.predicates.has(p)) { predOk = true; break }
    }
    if (!predOk) continue

    const jaccard = jaccardOf(poly.contentTerms, other.contentTerms)
    if (jaccard < 0.3) continue

    const sharedSupport = sharedSetCount(poly.support, other.support)
    const score =
      jaccard + (polyContainment + otherContainment) * 0.1 + sharedSupport * 0.05
    if (score > bestScore) {
      bestScore = score
      bestMatch = other.market
    }
  }

  return bestMatch ? { match: bestMatch, score: bestScore } : { match: null, score: 0 }
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

  // Pre-index Kalshi markets so each Polymarket lookup is fast.
  const indexedKalshi = indexMarkets(kalshiMarkets)
  const indexedKalshiById = new Map(indexedKalshi.map((m) => [m.market.id, m]))

  // Track already matched markets to avoid duplicates
  const matchedKalshi = new Set<string>()
  let exactMatches = 0
  let fuzzyMatches = 0
  let skippedLowScore = 0
  let skippedLowSpread = 0
  let skippedLowLiquidity = 0

  for (const poly of polymarketMarkets) {
    let kalshi: MarketPrice | null = kalshiMap.get(poly.title.toLowerCase()) ?? null
    let matchType = 'exact'

    // If no exact match, find best fuzzy match (over un-matched Kalshi only)
    if (!kalshi) {
      const polyIndexed = indexMarket(poly)
      const candidates = indexedKalshi.filter((m) => !matchedKalshi.has(m.market.id))
      const { match, score } = findBestMatchIndexed(polyIndexed, candidates)
      kalshi = match
      matchType = 'fuzzy'
      if (!kalshi || score < 0.3) continue
    }
    void indexedKalshiById

    if (matchType === 'exact') exactMatches++
    else fuzzyMatches++

    matchedKalshi.add(kalshi.id)

    const matchScore = calculateTitleSimilarity(poly.title, kalshi.title)

    // Real arbitrage requires both sides to be tradeable.
    //   - Polymarket exposes real liquidity → require >= $500.
    //   - Kalshi's public API hides liquidity, so we accept either real
    //     liquidity OR a "tradeable" flag (both bid & ask quoted).
    const MIN_POLY_LIQ = 500
    const kalshiTradeable = kalshi.liquidity >= MIN_POLY_LIQ || kalshi.tradeable === true
    if (poly.liquidity < MIN_POLY_LIQ || !kalshiTradeable) {
      skippedLowLiquidity++
      continue
    }

    // Calculate spreads for YES and NO outcomes
    const yesSpread = Math.abs(poly.yesPrice - kalshi.yesPrice)
    const noSpread = Math.abs(poly.noPrice - kalshi.noPrice)

    // A real cross-exchange arbitrage on the same market rarely exceeds 25¢.
    // Anything bigger is almost certainly a bad title match.
    const ABS_SPREAD_CAP = 0.25
    if (yesSpread > ABS_SPREAD_CAP || noSpread > ABS_SPREAD_CAP) continue

    // Log first few matches for debugging
    if (exactMatches + fuzzyMatches <= 3) {
      console.log(`[arb-engine] Match (${matchType}): "${poly.title.substring(0, 40)}" <-> "${kalshi.title.substring(0, 40)}" | poly=${poly.yesPrice.toFixed(3)}/${poly.noPrice.toFixed(3)} kalshi=${kalshi.yesPrice.toFixed(3)}/${kalshi.noPrice.toFixed(3)} | spread=${yesSpread.toFixed(3)}/${noSpread.toFixed(3)} | liq=${poly.liquidity}/${kalshi.liquidity}`)
    }

    // Check for YES arbitrage (buy on one, sell on other)
    if (poly.yesPrice < kalshi.yesPrice && yesSpread > 0.01) {
      const spreadPerc = ((kalshi.yesPrice - poly.yesPrice) / poly.yesPrice) * 100
      // The "liquidity" shown is whichever side we know about. Kalshi's
      // public API hides depth, so when only its liquidity is unknown we fall
      // back to Polymarket's number (the buy-side limiting factor).
      const minLiq =
        kalshi.liquidity > 0
          ? Math.min(poly.liquidity, kalshi.liquidity)
          : poly.liquidity

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
          liquidityUnknown: kalshi.liquidity === 0 && kalshi.tradeable === true,
          matchScore,
          confidence: spreadPerc > 5 ? 'high' : spreadPerc > 3 ? 'medium' : 'low',
          detectedAt: new Date().toISOString(),
          polymarketId: poly.id,
          kalshiId: kalshi.id,
        })
      }
    } else if (kalshi.yesPrice < poly.yesPrice && yesSpread > 0.01) {
      const spreadPerc = ((poly.yesPrice - kalshi.yesPrice) / kalshi.yesPrice) * 100
      // The "liquidity" shown is whichever side we know about. Kalshi's
      // public API hides depth, so when only its liquidity is unknown we fall
      // back to Polymarket's number (the buy-side limiting factor).
      const minLiq =
        kalshi.liquidity > 0
          ? Math.min(poly.liquidity, kalshi.liquidity)
          : poly.liquidity

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
          liquidityUnknown: kalshi.liquidity === 0 && kalshi.tradeable === true,
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
      // The "liquidity" shown is whichever side we know about. Kalshi's
      // public API hides depth, so when only its liquidity is unknown we fall
      // back to Polymarket's number (the buy-side limiting factor).
      const minLiq =
        kalshi.liquidity > 0
          ? Math.min(poly.liquidity, kalshi.liquidity)
          : poly.liquidity

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
          liquidityUnknown: kalshi.liquidity === 0 && kalshi.tradeable === true,
          matchScore,
          confidence: spreadPerc > 5 ? 'high' : spreadPerc > 3 ? 'medium' : 'low',
          detectedAt: new Date().toISOString(),
          polymarketId: poly.id,
          kalshiId: kalshi.id,
        })
      }
    } else if (kalshi.noPrice < poly.noPrice && noSpread > 0.01) {
      const spreadPerc = ((poly.noPrice - kalshi.noPrice) / kalshi.noPrice) * 100
      // The "liquidity" shown is whichever side we know about. Kalshi's
      // public API hides depth, so when only its liquidity is unknown we fall
      // back to Polymarket's number (the buy-side limiting factor).
      const minLiq =
        kalshi.liquidity > 0
          ? Math.min(poly.liquidity, kalshi.liquidity)
          : poly.liquidity

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
          liquidityUnknown: kalshi.liquidity === 0 && kalshi.tradeable === true,
          matchScore,
          confidence: spreadPerc > 5 ? 'high' : spreadPerc > 3 ? 'medium' : 'low',
          detectedAt: new Date().toISOString(),
          polymarketId: poly.id,
          kalshiId: kalshi.id,
        })
      }
    }
  }

  console.log(
    `[arb-engine] Summary: ${exactMatches} exact + ${fuzzyMatches} fuzzy matches, ` +
      `${skippedLowScore} low-score, ${skippedLowLiquidity} low-liquidity, ` +
      `${skippedLowSpread} low-spread skips, ${opportunities.length} opportunities found`,
  )

  // Sort by profit margin (highest first)
  return opportunities.sort((a, b) => b.profitMargin - a.profitMargin)
}

export function filterArbitrageByConfidence(
  opportunities: ArbitrageOpportunity[],
  minConfidenceSpread: number = 2
): ArbitrageOpportunity[] {
  return opportunities.filter((opp) => opp.spreadPercentage >= minConfidenceSpread)
}
