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

export async function fetchKalshiMarkets(
  limit: number = 100
): Promise<KalshiMarket[]> {
  console.log('[kalshi] fetchKalshiMarkets called with limit:', limit)
  try {
    const data = await fetchKalshiAPI(KALSHI_API, {
      limit,
      status: 'open',
    })
    
    console.log('[kalshi] API response received, type:', typeof data, 'has markets:', !!data?.markets)

    // Kalshi returns { markets: [...], cursor: "..." }
    const markets = Array.isArray(data?.markets) ? data.markets : []
    
    if (!Array.isArray(markets)) {
      console.log('[kalshi] No markets returned')
      return []
    }

    console.log(`[v0] Fetched ${markets.length} open markets from Kalshi`)

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

    console.log(`[kalshi] Pre-filter: ${markets.length} markets`)
    
    const filtered = markets.filter((market: any) => {
      const pass = market && market.ticker && (!market.status || market.status === 'open' || market.status === 'active')
      if (!pass && markets.length > 0 && markets.indexOf(market) === 0) {
        console.log('[kalshi] First market filtered out. Market:', JSON.stringify({
          ticker: market?.ticker,
          status: market?.status,
          has_ticker: !!market?.ticker,
        }))
      }
      return pass
    })
    
    console.log(`[kalshi] Post-filter: ${filtered.length} markets (status must be open or active or missing)`)
    
    const mapped = filtered
      .slice(0, limit)
      .map((market: any) => {
        // Kalshi prices can be in cents (0-100 integers) or dollars (0.00-1.00 floats)
        // SKIP zero prices - they indicate missing data
        let yesPrice = 0.5
        let priceSource = 'default'
        
        // Try yes_bid (cents: 0-100)
        if (market.yes_bid !== undefined && market.yes_bid !== null && market.yes_bid > 0) {
          yesPrice = market.yes_bid > 1 ? market.yes_bid / 100 : market.yes_bid
          priceSource = 'yes_bid'
        } 
        // Try yes_ask (cents: 0-100)
        else if (market.yes_ask !== undefined && market.yes_ask !== null && market.yes_ask > 0) {
          yesPrice = market.yes_ask > 1 ? market.yes_ask / 100 : market.yes_ask
          priceSource = 'yes_ask'
        } 
        // Try midpoint of bid/ask
        else if ((market.yes_bid || market.yes_ask) && (market.yes_bid > 0 || market.yes_ask > 0)) {
          const bid = market.yes_bid || 50
          const ask = market.yes_ask || 50
          yesPrice = ((bid + ask) / 2) / 100
          priceSource = 'bid_ask_midpoint'
        }
        // Try yes_bid_dollars (dollars: 0-1, skip if 0)
        else if (market.yes_bid_dollars !== undefined && market.yes_bid_dollars !== null) {
          const parsed = parseFloat(market.yes_bid_dollars)
          if (parsed > 0 && parsed <= 1) {
            yesPrice = parsed
            priceSource = 'yes_bid_dollars'
          }
        }
        // Try yes_ask_dollars (dollars: 0-1, skip if 0)
        else if (market.yes_ask_dollars !== undefined && market.yes_ask_dollars !== null) {
          const parsed = parseFloat(market.yes_ask_dollars)
          if (parsed > 0 && parsed <= 1) {
            yesPrice = parsed
            priceSource = 'yes_ask_dollars'
          }
        }
        // Try last_price (cents: 0-100)
        else if (market.last_price !== undefined && market.last_price !== null && market.last_price > 0) {
          yesPrice = market.last_price > 1 ? market.last_price / 100 : market.last_price
          priceSource = 'last_price'
        } 
        // Try last_price_dollars (dollars: 0-1, skip if 0)
        else if (market.last_price_dollars !== undefined && market.last_price_dollars !== null) {
          const parsed = parseFloat(market.last_price_dollars)
          if (parsed > 0 && parsed <= 1) {
            yesPrice = parsed
            priceSource = 'last_price_dollars'
          }
        }

        const noPrice = 1 - yesPrice

        return {
          id: `kalshi_${market.ticker}`,
          title: market.title || market.ticker || 'Unknown Market',
          description: market.subtitle,
          category: market.category || 'Kalshi',
          volume: market.volume || 0,
          volume24h: market.volume_24h || market.volume || 0,
          yes_price: yesPrice,
          no_price: noPrice,
          price: yesPrice,
          liquidity: parseFloat(market.liquidity_dollars || market.liquidity || market.open_interest || '0'),
          createdAt: market.created_time,
          updatedAt: market.updated_time || new Date().toISOString(),
        }
      })
    
    console.log(`[kalshi] Successfully mapped ${mapped.length} markets for return (limit was ${limit})`)
    return mapped
  } catch (error) {
    console.error('[kalshi] ERROR in fetchKalshiMarkets:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name,
    })
    return []
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
      .filter((market: any) => market && market.ticker && (!market.status || market.status === 'open' || market.status === 'active'))
      .sort((a: any, b: any) => (b.volume_24h || 0) - (a.volume_24h || 0))
      .slice(0, limit)
      .map((market: any) => {
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
        (!market.status || market.status === 'open' || market.status === 'active') &&
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
