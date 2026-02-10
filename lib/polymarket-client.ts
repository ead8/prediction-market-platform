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
  liquidity?: string
  outcomePrices?: string[]
  slug?: string
  outcomes?: string[]
  active?: boolean
  startDate?: string
  endDate?: string
}

const POLYMARKET_API = 'https://gamma-api.polymarket.com/markets'

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
      signal: AbortSignal.timeout(10000), // 10 second timeout
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
  offset: number = 0
): Promise<PolymarketMarket[]> {
  try {
    console.log('[polymarket] Fetching markets - endpoint:', POLYMARKET_API)
    
    // Use official API parameters from Polymarket documentation
    const data = await fetchPolymarketAPI(POLYMARKET_API, {
      limit,
      offset,
      closed: 'false', // Only get non-closed markets
      order: 'volume', // Sort by volume
      ascending: 'false', // Highest volume first
    })

    if (!Array.isArray(data)) {
      console.warn('[polymarket] Response is not an array:', typeof data)
      return []
    }

    console.log('[v0] Fetched %d markets from Polymarket', data.length)

    // Minimal filtering - only remove zero volume/liquidity
    return data
      .filter((market: any) => {
        const volume = parseFloat(String(market.volume || 0))
        const liquidity = parseFloat(String(market.liquidity || 0))
        
        if (volume === 0 || liquidity === 0) {
          return false
        }
        
        return true
      })
      .slice(0, limit)
      .map((market: PolymarketAPIMarket) => {
        let bestBid = 0.5
        let bestAsk = 0.5
        if (market.outcomePrices && Array.isArray(market.outcomePrices)) {
          const prices = market.outcomePrices
            .map((p: any) => parseFloat(String(p)))
            .filter((p: number) => !isNaN(p))
          if (prices.length > 0) {
            bestBid = Math.min(...prices)
            bestAsk = Math.max(...prices)
          }
        }

        return {
          id: `polymarket_${market.id}`,
          title: market.question,
          description: market.description,
          category: market.category || 'General',
          volume: parseFloat(market.volume || '0'),
          volume24h: parseFloat(market.volume24hr || market.volume || '0'),
          bestBid,
          bestAsk,
          price: (bestBid + bestAsk) / 2,
          liquidity: parseFloat(market.liquidity || '0'),
          createdAt: market.startDate,
          updatedAt: market.updatedAt || new Date().toISOString(),
          outcomePrices: market.outcomePrices,
        }
      })
  } catch (error) {
    console.error('[polymarket] Failed to fetch markets:', error instanceof Error ? error.message : error)
    throw error
  }
}

export async function fetchPolymarketTrendingMarkets(
  limit: number = 20
): Promise<PolymarketMarket[]> {
  try {
    const data = await fetchPolymarketAPI(POLYMARKET_API, {
      limit,
      closed: 'false',
      order: 'volume24hr', // Sort by 24hr volume for trending
      ascending: 'false',
    })

    if (!Array.isArray(data)) {
      return []
    }

    console.log('[v0] Fetched %d trending markets', data.length)

    return data
      .filter((market: any) => {
        const volume = parseFloat(String(market.volume24hr || market.volume || 0))
        const liquidity = parseFloat(String(market.liquidity || 0))
        return volume > 0 && liquidity > 0
      })
      .slice(0, limit)
      .map((market: PolymarketAPIMarket) => {
        let bestBid = 0.5
        let bestAsk = 0.5
        if (market.outcomePrices && Array.isArray(market.outcomePrices)) {
          const prices = market.outcomePrices
            .map((p: any) => parseFloat(String(p)))
            .filter((p: number) => !isNaN(p))
          if (prices.length > 0) {
            bestBid = Math.min(...prices)
            bestAsk = Math.max(...prices)
          }
        }

        return {
          id: `polymarket_${market.id}`,
          title: market.question,
          description: market.description,
          category: market.category || 'General',
          volume: parseFloat(market.volume || '0'),
          volume24h: parseFloat(market.volume24hr || market.volume || '0'),
          bestBid,
          bestAsk,
          price: (bestBid + bestAsk) / 2,
          liquidity: parseFloat(market.liquidity || '0'),
          createdAt: market.startDate,
          updatedAt: market.updatedAt || new Date().toISOString(),
          outcomePrices: market.outcomePrices,
        }
      })
  } catch (error) {
    console.error('[polymarket] Failed to fetch trending markets:', error)
    throw error
  }
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

    let bestBid = 0.5
    let bestAsk = 0.5
    if (market.outcomePrices && Array.isArray(market.outcomePrices)) {
      const prices = market.outcomePrices
        .map((p: any) => parseFloat(String(p)))
        .filter((p: number) => !isNaN(p))
      if (prices.length > 0) {
        bestBid = Math.min(...prices)
        bestAsk = Math.max(...prices)
      }
    }

    return {
      id: `polymarket_${market.id}`,
      title: market.question,
      description: market.description,
      category: market.category || 'General',
      volume: parseFloat(market.volume || '0'),
      volume24h: parseFloat(market.volume || '0'),
      bestBid,
      bestAsk,
      price: (bestBid + bestAsk) / 2,
      liquidity: parseFloat(market.liquidity || '0'),
      createdAt: market.startDate,
      updatedAt: new Date().toISOString(),
      outcomePrices: market.outcomePrices,
    }
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
      .map((market: PolymarketAPIMarket) => {
        let bestBid = 0.5
        let bestAsk = 0.5
        if (market.outcomePrices && Array.isArray(market.outcomePrices)) {
          const prices = market.outcomePrices
            .map((p: any) => parseFloat(String(p)))
            .filter((p: number) => !isNaN(p))
          if (prices.length > 0) {
            bestBid = Math.min(...prices)
            bestAsk = Math.max(...prices)
          }
        }

        return {
          id: `polymarket_${market.id}`,
          title: market.question,
          description: market.description,
          category: market.category || 'General',
          volume: parseFloat(market.volume || '0'),
          volume24h: parseFloat(market.volume24hr || market.volume || '0'),
          bestBid,
          bestAsk,
          price: (bestBid + bestAsk) / 2,
          liquidity: parseFloat(market.liquidity || '0'),
          createdAt: market.startDate,
          updatedAt: market.updatedAt || new Date().toISOString(),
          outcomePrices: market.outcomePrices,
        }
      })

    console.log('[v0] Search found %d results for "%s"', filtered.length, query)
    return filtered
  } catch (error) {
    console.error('[polymarket] Search failed:', error)
    throw error
  }
}
