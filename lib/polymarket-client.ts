// Polymarket REST API client for fetching real market data
// Polymarket public API: https://gamma-api.polymarket.com

interface PolymarketMarket {
  id: string
  title: string
  description?: string
  category?: string
  volume?: number
  volume24h?: number
  bestBid?: number
  bestAsk?: number
  price?: number
  liquidity?: number
  createdAt?: string
  updatedAt?: string
  outcomePrices?: string[]
}

interface PolymarketAPIMarket {
  id: string
  question: string
  description?: string
  category?: string
  volume?: string
  volume24hr?: string | number
  liquidity?: string
  // Polymarket gamma API returns outcomePrices as a JSON-encoded string, e.g. "[\"0.42\",\"0.58\"]"
  outcomePrices?: string | string[]
  slug?: string
  outcomes?: string | string[]
  active?: boolean
  startDate?: string
  endDate?: string
  updatedAt?: string
  events?: Array<{ title?: string; tags?: Array<{ label?: string }> }>
}

// Polymarket gamma API returns most fields as strings (or sometimes as JSON-encoded strings).
// This helper parses outcomePrices safely whether it comes through as an array or a JSON string.
function parseOutcomePrices(raw: unknown): number[] {
  if (!raw) return []
  let arr: unknown = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((p) => parseFloat(String(p)))
    .filter((n) => !isNaN(n))
}

// Polymarket categorizes via events[0].tags. Pick the most descriptive top-level tag.
const PRIMARY_TAGS = [
  'Politics',
  'Sports',
  'Crypto',
  'Tech',
  'Culture',
  'Economy',
  'World',
  'Elections',
  'Trump',
  'Soccer',
  'NFL',
  'NBA',
  'MLB',
  'Tennis',
  'AI',
  'Climate',
  'Entertainment',
  'Finance',
  'Science',
  'Health',
]

// Keyword-based fallback when no /events tags are available.
// Polymarket gamma /markets does NOT expose tags, and /events is currently
// very slow, so we infer a category from the question text.
const KEYWORD_RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'Crypto', patterns: [/bitcoin|btc|ethereum|eth\b|crypto|solana|doge|coinbase|microstrategy|stablecoin/i] },
  { category: 'Trump', patterns: [/\btrump\b/i] },
  { category: 'Elections', patterns: [/election|primary|nominee|presidential|senate|governor|congress|prime minister/i] },
  { category: 'Politics', patterns: [/politic|impeach|cabinet|secretary of|supreme court|justice|senator|biden|kamala|harris|vance|kennedy|democrat|republican|gop/i] },
  { category: 'Sports', patterns: [/super bowl|nba|nfl|mlb|nhl|world cup|fifa|champions league|premier league|tennis|wta|atp|ufc|boxing|olympics|stanley cup|world series|mvp|nascar|f1\b|formula 1|playoffs|finals|grand slam/i] },
  { category: 'Tech', patterns: [/openai|chatgpt|anthropic|claude\b|google\b|meta\b|tesla|spacex|apple\b|microsoft|nvidia|ai\b|gpt-|musk|software|model release/i] },
  { category: 'World', patterns: [/ukraine|russia|israel|gaza|hamas|hezbollah|china|iran|north korea|nato|un\b|treaty|peace deal|war\b|invasion|ceasefire|sanction/i] },
  { category: 'Economy', patterns: [/recession|inflation|fed\b|federal reserve|gdp|unemployment|cpi|interest rate|stock market|s&p 500|dow|nasdaq|deficit|tariff|economy|jobs report/i] },
  { category: 'Culture', patterns: [/oscar|grammy|emmy|swift|kardashian|netflix|hbo|movie|album|celebrity|popstar|artist of the year|met gala/i] },
]

function deriveCategory(market: PolymarketAPIMarket): string {
  // 1) Prefer real /events tags when available (high signal)
  const tags =
    market.events?.[0]?.tags?.map((t) => t?.label).filter(Boolean) || []
  if (tags.length > 0) {
    for (const preferred of PRIMARY_TAGS) {
      const hit = tags.find(
        (t) => t && t.toLowerCase() === preferred.toLowerCase(),
      )
      if (hit) return hit
    }
    const noise = ['Hide From New', 'Featured', 'Trending', 'Mentions']
    const first = tags.find((t) => t && !noise.includes(t))
    if (first) return first
  }

  // 2) Fall back to keyword rules over the market question + event title
  const haystack = `${market.question || ''} ${market.events?.[0]?.title || ''}`
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(haystack))) return rule.category
  }

  // 3) Last resort
  return market.category || 'General'
}

function normalizeMarket(market: PolymarketAPIMarket): PolymarketMarket {
  // outcomePrices[0] is YES, outcomePrices[1] is NO for binary markets.
  const prices = parseOutcomePrices(market.outcomePrices)
  const yesPrice = prices[0] ?? 0.5
  const noPrice = prices[1] ?? 1 - yesPrice

  return {
    id: `polymarket_${market.id}`,
    title: market.question,
    description: market.description,
    category: deriveCategory(market),
    volume: parseFloat(String(market.volume || '0')),
    volume24h: parseFloat(String(market.volume24hr ?? market.volume ?? '0')),
    bestBid: yesPrice,
    bestAsk: noPrice,
    price: yesPrice,
    liquidity: parseFloat(String(market.liquidity || '0')),
    createdAt: market.startDate,
    updatedAt: market.updatedAt || new Date().toISOString(),
    outcomePrices: prices.map(String),
  }
}

const POLYMARKET_API = 'https://gamma-api.polymarket.com/markets'
const POLYMARKET_EVENTS_API = 'https://gamma-api.polymarket.com/events'

// Module-level cache for the events response so repeated category clicks don't
// re-hit the gamma API (each fetch is multi-megabyte and several seconds slow).
const EVENTS_CACHE_TTL_MS = 120_000 // 2 minutes — Polymarket's API is slow
let eventsCache: { ts: number; data: any[] } | null = null
let eventsInflight: Promise<any[]> | null = null

// Walk the /events endpoint, which is the only place Polymarket exposes tag
// metadata. Each event yields N markets, all tagged with the event's category.
//
// Note: Polymarket gamma is currently very slow whenever `order=` is set
// (~30s for 50+ events). We fetch with default ordering (fast: ~3s) and sort
// client-side by `order`.
async function fetchPolymarketMarketsViaEvents(
  limit: number,
  order: 'volume' | 'volume24hr' | 'createdAt',
  tag?: string,
): Promise<PolymarketMarket[]> {
  let events: any[]
  if (eventsCache && Date.now() - eventsCache.ts < EVENTS_CACHE_TTL_MS) {
    events = eventsCache.data
  } else if (eventsInflight) {
    // De-dupe concurrent calls
    events = await eventsInflight
  } else {
    eventsInflight = (async () => {
      const fetched = await fetchPolymarketAPI(POLYMARKET_EVENTS_API, {
        limit: 50,
        closed: 'false',
        // No `order` — that triggers a 30s+ slow path on Polymarket's API.
      })
      const arr = Array.isArray(fetched) ? fetched : []
      eventsCache = { ts: Date.now(), data: arr }
      return arr
    })()
    try {
      events = await eventsInflight
    } finally {
      eventsInflight = null
    }
  }

  // Client-side sort by the requested order
  const orderKey = order === 'volume' ? 'volume' : order === 'volume24hr' ? 'volume24hr' : 'createdAt'
  events = [...events].sort((a, b) => {
    if (orderKey === 'createdAt') {
      return (
        new Date(b.createdAt || b.startDate || 0).getTime() -
        new Date(a.createdAt || a.startDate || 0).getTime()
      )
    }
    const av = parseFloat(String(a[orderKey] || 0))
    const bv = parseFloat(String(b[orderKey] || 0))
    return bv - av
  })

  // Collect markets from every event (each one tagged with its event's labels),
  // then if a tag was requested, prioritize markets that match it.
  const all: PolymarketMarket[] = []
  for (const event of events) {
    const synth: PolymarketAPIMarket['events'] = [
      { title: event?.title, tags: (event?.tags || []) as any },
    ]

    for (const market of event?.markets || []) {
      const m = { ...market, events: synth } as PolymarketAPIMarket
      const volume = parseFloat(
        String((market as any).volume24hr || (market as any).volume || 0),
      )
      const liquidity = parseFloat(String((market as any).liquidity || 0))
      if (volume <= 0 || liquidity <= 0) continue
      all.push(normalizeMarket(m))
    }
  }

  if (tag) {
    const target = tag.toLowerCase()
    const matching = all.filter((m) =>
      (m.category || '').toLowerCase().includes(target),
    )
    const rest = all.filter(
      (m) => !(m.category || '').toLowerCase().includes(target),
    )
    return [...matching, ...rest].slice(0, limit)
  }

  return all.slice(0, limit)
}

async function fetchPolymarketAPI(
  endpoint: string,
  params?: Record<string, any>
) {
  try {
    const url = new URL(endpoint)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    console.log('[polymarket] Fetching:', url.toString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(20000), // 20 second timeout — /events is heavy
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[polymarket] HTTP error:', response.status, errorText.substring(0, 200))
      throw new Error(
        `Polymarket API error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    console.log('[polymarket] Successfully fetched response')
    return data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[polymarket] Network error - fetch failed:', error.message)
    } else if (error instanceof Error) {
      console.error('[polymarket] API error:', error.message)
    } else {
      console.error('[polymarket] API error:', error)
    }
    throw error
  }
}

export async function fetchPolymarketMarkets(
  limit: number = 100,
  offset: number = 0,
  tag?: string,
): Promise<PolymarketMarket[]> {
  void offset
  // Primary path: /markets endpoint is faster (~5–15s) and carries volume,
  // outcomePrices, and embedded events for category derivation.
  const data = await fetchPolymarketAPI(POLYMARKET_API, {
    limit,
    closed: 'false',
    active: 'true',
  })

  if (!Array.isArray(data)) {
    console.warn('[polymarket] Response is not an array:', typeof data)
    return []
  }

  const normalized = data
    .filter((market: any) => {
      const volume = parseFloat(String(market.volume || 0))
      const liquidity = parseFloat(String(market.liquidity || 0))
      return volume > 0 && liquidity > 0
    })
    .map((market: PolymarketAPIMarket) => normalizeMarket(market))

  // Sort client-side by volume (the API's own `order=volume` is currently slow).
  normalized.sort((a, b) => (b.volume || 0) - (a.volume || 0))

  // Optional tag prioritization (case-insensitive substring match on the
  // derived category).
  if (tag) {
    const target = tag.toLowerCase()
    const matching = normalized.filter((m) =>
      (m.category || '').toLowerCase().includes(target),
    )
    const rest = normalized.filter(
      (m) => !(m.category || '').toLowerCase().includes(target),
    )
    return [...matching, ...rest].slice(0, limit)
  }

  console.log(`[v0] Fetched ${normalized.length} markets from Polymarket`)
  return normalized.slice(0, limit)
}

export async function fetchPolymarketTrendingMarkets(
  limit: number = 20,
): Promise<PolymarketMarket[]> {
  // Reuse the same /markets fetch and re-sort by volume24hr client-side.
  const all = await fetchPolymarketMarkets(Math.max(100, limit * 2))
  return [...all]
    .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
    .slice(0, limit)
}

export async function fetchPolymarketMarketByID(
  marketID: string
): Promise<PolymarketMarket | null> {
  try {
    const data = await fetchPolymarketAPI(`${POLYMARKET_API}/${marketID}`)

    if (!data || typeof data !== 'object') {
      return null
    }

    const market = data as PolymarketAPIMarket
    return normalizeMarket(market)
  } catch (error) {
    console.error('[polymarket] Failed to fetch market:', error)
    throw error
  }
}

export async function searchPolymarketMarkets(
  query: string,
  limit: number = 50
): Promise<PolymarketMarket[]> {
  try {
    // Search uses the same endpoint but we filter client-side
    const data = await fetchPolymarketAPI(POLYMARKET_API, {
      limit: 200,
      closed: 'false',
    })

    if (!Array.isArray(data)) {
      return []
    }

    const filtered = data
      .filter((market: any) => {
        // Must match search query
        const matchesQuery =
          market.question?.toLowerCase().includes(query.toLowerCase()) ||
          market.description?.toLowerCase().includes(query.toLowerCase())

        if (!matchesQuery) return false

        // Must have volume and liquidity
        const volume = parseFloat(String(market.volume || 0))
        const liquidity = parseFloat(String(market.liquidity || 0))
        return volume > 0 && liquidity > 0
      })
      .slice(0, limit)
      .map((market: PolymarketAPIMarket) => normalizeMarket(market))

    console.log('[v0] Search found %d results for "%s"', filtered.length, query)
    return filtered
  } catch (error) {
    console.error('[polymarket] Search failed:', error)
    throw error
  }
}
