// Kalshi REST API client for fetching prediction market data
// Kalshi API: https://api.elections.kalshi.com/trade-api/v2

interface KalshiMarket {
  id: string
  title: string
  description?: string
  category?: string
  volume?: number
  volume24h?: number
  yes_price?: number
  no_price?: number
  price?: number
  liquidity?: number
  // Kalshi's public market-list endpoint doesn't expose real liquidity numbers
  // (liquidity_dollars is always "0.0000"). We treat a market as "tradeable"
  // when it has both a yes bid and a yes ask quoted, which means there's an
  // orderbook with active quotes even if the dollar depth is hidden.
  tradeable?: boolean
  yesBid?: number
  yesAsk?: number
  createdAt?: string
  updatedAt?: string
}

interface KalshiAPIMarket {
  ticker: string
  title: string
  subtitle?: string
  yes_bid_dollars?: string
  yes_ask_dollars?: string
  no_bid_dollars?: string
  no_ask_dollars?: string
  volume?: number
  volume_24h?: number
  liquidity_dollars?: string
  last_price_dollars?: string
  created_time?: string
  updated_time?: string
}

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2/markets'

// Kalshi doesn't tag markets with a real category, so we infer one from the
// market title (same approach as the Polymarket client). Order matters — more
// specific tags win.
const KALSHI_KEYWORD_RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'Crypto', patterns: [/bitcoin|btc|ethereum|eth\b|crypto|solana|doge|coinbase|stablecoin/i] },
  { category: 'Trump', patterns: [/\btrump\b/i] },
  { category: 'Elections', patterns: [/election|primary|nominee|presidential|prime minister|next pope/i] },
  { category: 'Politics', patterns: [/politic|impeach|cabinet|secretary of|supreme court|justice|senator|congress|senate|governor|democrat|republican|gop/i] },
  { category: 'Sports', patterns: [/super bowl|nba|nfl|mlb|nhl|world cup|fifa|premier league|tennis|wta|atp|ufc|boxing|olympics|stanley cup|world series|mvp|nascar|f1\b|formula 1|playoffs|finals|grand slam/i] },
  { category: 'Tech', patterns: [/openai|chatgpt|anthropic|claude\b|google|meta\b|tesla|spacex|apple\b|microsoft|nvidia|ai\b|gpt-|musk|software|model release|mars\b/i] },
  { category: 'World', patterns: [/ukraine|russia|israel|gaza|hamas|hezbollah|china|iran|north korea|nato|treaty|peace deal|war\b|invasion|ceasefire|sanction/i] },
  { category: 'Economy', patterns: [/recession|inflation|fed\b|federal reserve|gdp|unemployment|cpi|interest rate|stock market|s&p 500|dow|nasdaq|deficit|tariff|economy|jobs report/i] },
  { category: 'Culture', patterns: [/oscar|grammy|emmy|swift|kardashian|netflix|hbo|movie|album|celebrity|popstar|met gala/i] },
  { category: 'Weather', patterns: [/temperature|rain|snow|storm|hurricane|weather|wildfire/i] },
]

function deriveKalshiCategory(title: string): string {
  for (const rule of KALSHI_KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(title))) return rule.category
  }
  return 'Kalshi'
}

async function fetchKalshiAPI(
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

    console.log('[kalshi] Fetching from:', url.toString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.warn('[kalshi] HTTP error:', response.status, text.substring(0, 100))
      throw new Error(
        `Kalshi API HTTP ${response.status}: ${response.statusText}`
      )
    }

    const contentType = response.headers.get('content-type')
    
    // Handle cases where content-type is missing or invalid
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      console.warn('[kalshi] Invalid/missing content type:', contentType)
      console.warn('[kalshi] Response text:', text.substring(0, 200))
      
      // Try to parse as JSON anyway if response looks like JSON
      if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
        try {
          return JSON.parse(text)
        } catch (e) {
          console.error('[kalshi] Failed to parse JSON response:', e)
          throw new Error('Invalid JSON response from Kalshi API')
        }
      }
      
      throw new Error(
        `Invalid response format from Kalshi API. Expected JSON, got: ${contentType || 'no content-type'}`
      )
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('[kalshi] API error:', error)
    throw error
  }
}

// Two-tier cache:
//   - "wide" cache: the full paginated catalog (4k+ markets), expensive to
//     fetch (~10s) but kept fresh-ish for arbitrage scans.
//   - When a wide fetch is fresh, narrow callers reuse it (free).
//   - When only a narrow fetch is needed, we hit page 1 only (~2s).
let kalshiWideCache: { ts: number; data: any[] } | null = null
let kalshiWideInflight: Promise<any[]> | null = null
const KALSHI_WIDE_TTL_MS = 5 * 60_000 // 5 minutes — Kalshi prices update frequently but the market list is stable

async function fetchAllKalshiPages(): Promise<any[]> {
  if (kalshiWideCache && Date.now() - kalshiWideCache.ts < KALSHI_WIDE_TTL_MS) {
    return kalshiWideCache.data
  }
  if (kalshiWideInflight) return kalshiWideInflight

  kalshiWideInflight = (async () => {
    const minCloseTs = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60
    let cursor: string | undefined
    const all: any[] = []
    for (let i = 0; i < 5; i++) {
      const params: Record<string, any> = {
        limit: 1000,
        status: 'open',
        min_close_ts: minCloseTs,
      }
      if (cursor) params.cursor = cursor
      const data: any = await fetchKalshiAPI(KALSHI_API, params)
      const page: any[] = Array.isArray(data?.markets) ? data.markets : []
      all.push(...page)
      cursor = data?.cursor
      if (!cursor || page.length === 0) break
    }
    const filtered = all.filter((m) => m && !m.mve_collection_ticker)
    kalshiWideCache = { ts: Date.now(), data: filtered }
    return filtered
  })()
  try {
    return await kalshiWideInflight
  } finally {
    kalshiWideInflight = null
  }
}

async function fetchKalshiSinglePage(): Promise<any[]> {
  // If the wide cache is warm, skip the network call entirely.
  if (kalshiWideCache && Date.now() - kalshiWideCache.ts < KALSHI_WIDE_TTL_MS) {
    return kalshiWideCache.data
  }
  const minCloseTs = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60
  const data: any = await fetchKalshiAPI(KALSHI_API, {
    limit: 1000,
    status: 'open',
    min_close_ts: minCloseTs,
  })
  const page: any[] = Array.isArray(data?.markets) ? data.markets : []
  return page.filter((m) => m && !m.mve_collection_ticker)
}

export async function fetchKalshiMarkets(
  limit: number = 100,
  offset: number = 0,
): Promise<KalshiMarket[]> {
  try {
    void offset
    // For arbitrage (large limits) we paginate. For everything else we just
    // hit page 1 — much faster, and we'll piggyback on the wide cache if it's
    // already warm.
    const markets = limit > 1000 ? await fetchAllKalshiPages() : await fetchKalshiSinglePage()
    if (markets.length === 0) {
      console.log('[kalshi] No markets returned')
      return []
    }

    console.log(`[v0] Fetched ${markets.length} open Kalshi markets (${limit > 1000 ? 'paginated' : 'single page'})`)

    // Log the first market's raw fields for debugging
    if (markets.length > 0) {
      const s = markets[0]
      console.log('[kalshi] Sample raw market:', JSON.stringify({
        ticker: s.ticker,
        title: s.title?.substring(0, 50),
        status: s.status,
        yes_bid: s.yes_bid,
        yes_ask: s.yes_ask,
        no_bid: s.no_bid,
        no_ask: s.no_ask,
        yes_bid_dollars: s.yes_bid_dollars,
        yes_ask_dollars: s.yes_ask_dollars,
        last_price: s.last_price,
        last_price_dollars: s.last_price_dollars,
        volume: s.volume,
        volume_24h: s.volume_24h,
        liquidity: s.liquidity,
        liquidity_dollars: s.liquidity_dollars,
        open_interest: s.open_interest,
      }))
    }

    return markets
      .filter((market: any) => {
        if (!market || !market.ticker) return false
        if (market.status !== 'open' && market.status !== 'active') return false
        // Skip multivariate / combo markets — their titles are mangled and
        // their prices are all zero, so they can't be arbitraged usefully.
        if (market.mve_collection_ticker) return false
        // Require some sign of activity: a YES bid/ask, last price, or liquidity.
        const yesAsk = parseFloat(market.yes_ask_dollars || '0')
        const yesBid = parseFloat(market.yes_bid_dollars || '0')
        const lastPrice = parseFloat(market.last_price_dollars || '0')
        const liquidity = parseFloat(market.liquidity_dollars || '0')
        const openInterest = parseFloat(market.open_interest || '0')
        return (
          yesAsk > 0 ||
          yesBid > 0 ||
          lastPrice > 0 ||
          liquidity > 0 ||
          openInterest > 0
        )
      })
      .sort((a: any, b: any) => {
        // Prefer markets with real liquidity, fall back to volume.
        const la = parseFloat(a.liquidity_dollars || '0') + (a.volume || 0) * 0.01
        const lb = parseFloat(b.liquidity_dollars || '0') + (b.volume || 0) * 0.01
        return lb - la
      })
      .slice(0, limit)
      .map((market: any) => {
        // Kalshi prices can be in cents (0-100 integers) or dollars (0.00-1.00 floats).
        // Prefer the mid of bid/ask when both are available, else fall back to
        // last price.
        const toUnit = (v: any) => {
          if (v === undefined || v === null) return undefined
          const n = typeof v === 'string' ? parseFloat(v) : v
          if (isNaN(n) || n <= 0) return undefined
          return n > 1 ? n / 100 : n
        }

        const ask =
          toUnit(market.yes_ask) ?? toUnit(market.yes_ask_dollars)
        const bid =
          toUnit(market.yes_bid) ?? toUnit(market.yes_bid_dollars)
        const last =
          toUnit(market.last_price) ?? toUnit(market.last_price_dollars)

        let yesPrice = 0.5
        if (ask !== undefined && bid !== undefined) {
          yesPrice = (ask + bid) / 2
        } else if (ask !== undefined) {
          yesPrice = ask
        } else if (bid !== undefined) {
          yesPrice = bid
        } else if (last !== undefined) {
          yesPrice = last
        }

        const noPrice = 1 - yesPrice

        const title = market.title || market.ticker || 'Unknown Market'

        // Numeric liquidity (often missing on Kalshi public API).
        const liquidity = (() => {
          const candidates = [
            market.liquidity_dollars,
            market.liquidity,
            market.open_interest,
            market.volume_24h,
          ]
          for (const c of candidates) {
            const n = parseFloat(String(c ?? 0))
            if (n > 0) return n
          }
          return 0
        })()

        // A market is tradeable when it has both bid AND ask quoted —
        // there's an orderbook to fill against, even if the API hides depth.
        const tradeable = bid !== undefined && ask !== undefined

        return {
          id: `kalshi_${market.ticker}`,
          title,
          description: market.subtitle,
          category: deriveKalshiCategory(title),
          volume: market.volume || 0,
          volume24h: market.volume_24h || market.volume || 0,
          yes_price: yesPrice,
          no_price: noPrice,
          price: yesPrice,
          liquidity,
          tradeable,
          yesBid: bid,
          yesAsk: ask,
          createdAt: market.created_time,
          updatedAt: market.updated_time || new Date().toISOString(),
        }
      })
  } catch (error) {
    console.warn('[kalshi] Failed to fetch markets:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function fetchKalshiTrendingMarkets(
  limit: number = 20
): Promise<KalshiMarket[]> {
  try {
    const data = await fetchKalshiAPI(KALSHI_API, {
      limit,
      status: 'open',
    })

    const markets = Array.isArray(data?.markets) ? data.markets : []

    if (!Array.isArray(markets)) {
      return []
    }

    // Sort by volume to get trending
    const trending = markets
      .filter((market: any) => market && market.ticker && (market.status === 'open' || market.status === 'active'))
      .sort((a: any, b: any) => (b.volume_24h || 0) - (a.volume_24h || 0))
      .slice(0, limit)
      .map((market: any) => {
        const yesPrice = parseFloat(market.yes_ask_dollars || market.last_price_dollars || '0.5')
        const noPrice = 1 - yesPrice

        return {
          id: `kalshi_${market.ticker}`,
          title: market.title || market.ticker || 'Unknown Market',
          description: market.subtitle,
          category: deriveKalshiCategory(market.title || market.ticker || ''),
          volume: market.volume || 0,
          volume24h: market.volume_24h || market.volume || 0,
          yes_price: yesPrice,
          no_price: noPrice,
          price: yesPrice,
          liquidity: parseFloat(market.liquidity_dollars || '0'),
          createdAt: market.created_time,
          updatedAt: market.updated_time || new Date().toISOString(),
        }
      })

    return trending
  } catch (error) {
    console.warn('[kalshi] Failed to fetch trending markets:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function searchKalshiMarkets(
  query: string,
  limit: number = 50
): Promise<KalshiMarket[]> {
  try {
    const data = await fetchKalshiAPI(KALSHI_API, {
      limit: 200,
      status: 'open',
    })

    const markets = Array.isArray(data?.markets) ? data.markets : []
    
    if (!Array.isArray(markets)) {
      return []
    }

    const filtered = markets
      .filter((market: any) =>
        market &&
        (market.status === 'open' || market.status === 'active') &&
        (market.title?.toLowerCase().includes(query.toLowerCase()) ||
         market.ticker?.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, limit)
      .map((market: any) => {
        const yesPrice = parseFloat(market.yes_ask_dollars || market.last_price_dollars || '0.5')
        const noPrice = 1 - yesPrice

        return {
          id: `kalshi_${market.ticker}`,
          title: market.title || market.ticker || 'Unknown Market',
          description: market.subtitle,
          category: deriveKalshiCategory(market.title || market.ticker || ''),
          volume: market.volume || 0,
          volume24h: market.volume_24h || market.volume || 0,
          yes_price: yesPrice,
          no_price: noPrice,
          price: yesPrice,
          liquidity: parseFloat(market.liquidity_dollars || '0'),
          createdAt: market.created_time,
          updatedAt: market.updated_time || new Date().toISOString(),
        }
      })

    console.log(`[v0] Search found ${filtered.length} Kalshi markets for "${query}"`)
    return filtered
  } catch (error) {
    console.warn('[kalshi] Search failed:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function fetchKalshiMarketByID(
  marketID: string
): Promise<KalshiMarket | null> {
  try {
    // Kalshi API doesn't have a single market endpoint, so fetch all and filter
    const data = await fetchKalshiAPI(KALSHI_API, {
      tickers: marketID,
      status: 'open',
    })

    const markets = Array.isArray(data?.markets) ? data.markets : []
    const market = markets.find((m: any) => m.ticker === marketID)

    if (!market) {
      return null
    }

    const yesPrice = parseFloat(market.yes_ask_dollars || market.last_price_dollars || '0.5')
    const noPrice = 1 - yesPrice

    return {
      id: `kalshi_${market.ticker}`,
      title: market.title || market.ticker || 'Unknown Market',
      description: market.subtitle,
      category: 'Kalshi',
      volume: market.volume || 0,
      volume24h: market.volume_24h || market.volume || 0,
      yes_price: yesPrice,
      no_price: noPrice,
      price: yesPrice,
      liquidity: parseFloat(market.liquidity_dollars || '0'),
      createdAt: market.created_time,
      updatedAt: market.updated_time || new Date().toISOString(),
    }
  } catch (error) {
    console.warn('[kalshi] Failed to fetch market:', error instanceof Error ? error.message : error)
    return null
  }
}
