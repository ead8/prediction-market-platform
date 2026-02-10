import { db } from '@/lib/db'

export interface AggregatedMarket {
  id: string
  source: 'polymarket' | 'kalshi'
  title: string
  category: string
  description: string
  createdAt: Date
  endDate: Date
  currentPrice: number
  volume24h: number
  liquidity: number
  outcomes: Array<{
    name: string
    probability: number
    price: number
  }>
  url: string
}

/**
 * Polymarket GraphQL queries
 */
async function fetchPolymarketMarkets(): Promise<AggregatedMarket[]> {
  try {
    const response = await fetch('https://clob.polymarket.com/markets', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) throw new Error(`Polymarket API error: ${response.status}`)

    const markets: any[] = await response.json()

    return markets
      .filter((m) => m.active && m.closed === false)
      .slice(0, 100)
      .map((market) => ({
        id: `polymarket-${market.id}`,
        source: 'polymarket' as const,
        title: market.question,
        category: market.tags?.[0] || 'General',
        description: market.description || '',
        createdAt: new Date(market.createdAt),
        endDate: new Date(market.endDate),
        currentPrice: parseFloat(market.lastPrice || '0.5'),
        volume24h: parseFloat(market.volume24h || '0'),
        liquidity: parseFloat(market.liquidity || '0'),
        outcomes: market.outcomes?.map((outcome: any) => ({
          name: outcome.name,
          probability: parseFloat(outcome.price || '0.5'),
          price: parseFloat(outcome.price || '0.5'),
        })) || [],
        url: `https://polymarket.com/market/${market.id}`,
      }))
  } catch (error) {
    console.error('[aggregator] Polymarket fetch error:', error)
    return []
  }
}

/**
 * Kalshi REST API
 */
async function fetchKalshiMarkets(): Promise<AggregatedMarket[]> {
  try {
    const response = await fetch('https://api.kalshi.com/v2/markets', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) throw new Error(`Kalshi API error: ${response.status}`)

    const data: any = await response.json()
    const markets = data.markets || []

    return markets
      .filter((m: any) => m.status === 'open')
      .slice(0, 100)
      .map((market: any) => ({
        id: `kalshi-${market.id}`,
        source: 'kalshi' as const,
        title: market.title,
        category: market.category || 'General',
        description: market.description || '',
        createdAt: new Date(market.created_at),
        endDate: new Date(market.expiration_date),
        currentPrice:
          (parseFloat(market.last_price_yes || '0') +
            parseFloat(market.last_price_no || '0')) /
          2,
        volume24h: parseFloat(market.volume_24h || '0'),
        liquidity:
          parseFloat(market.last_price_yes_implied_probability || '0') *
          parseFloat(market.volume || '0'),
        outcomes: [
          {
            name: 'Yes',
            probability: parseFloat(
              market.last_price_yes_implied_probability || '0'
            ),
            price: parseFloat(market.last_price_yes || '0.5'),
          },
          {
            name: 'No',
            probability: parseFloat(
              market.last_price_no_implied_probability || '0'
            ),
            price: parseFloat(market.last_price_no || '0.5'),
          },
        ],
        url: `https://kalshi.com/markets/${market.id}`,
      }))
  } catch (error) {
    console.error('[aggregator] Kalshi fetch error:', error)
    return []
  }
}

/**
 * Aggregate markets from all sources, deduplicate, and sync to DB
 */
export async function aggregateAndSyncMarkets(): Promise<AggregatedMarket[]> {
  try {
    const [polymarketMarkets, kalshiMarkets] = await Promise.all([
      fetchPolymarketMarkets(),
      fetchKalshiMarkets(),
    ])

    const allMarkets = [...polymarketMarkets, ...kalshiMarkets]

    // Store/update markets in database
    for (const market of allMarkets) {
      await db.query(
        `
        INSERT INTO markets (id, source, title, category, description, created_at, end_date, current_price, volume_24h, liquidity, url, outcomes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          current_price = $8,
          volume_24h = $9,
          liquidity = $10,
          outcomes = $12,
          updated_at = NOW()
        `,
        [
          market.id,
          market.source,
          market.title,
          market.category,
          market.description,
          market.createdAt,
          market.endDate,
          market.currentPrice,
          market.volume24h,
          market.liquidity,
          market.url,
          JSON.stringify(market.outcomes),
        ]
      )
    }

    console.log(
      `[aggregator] Synced ${allMarkets.length} markets (${polymarketMarkets.length} Polymarket, ${kalshiMarkets.length} Kalshi)`
    )

    return allMarkets
  } catch (error) {
    console.error('[aggregator] Aggregation error:', error)
    throw error
  }
}

/**
 * Get top movers (biggest price changes)
 */
export async function getTopMovers(timeframe: '1h' | '24h' = '24h') {
  const result = await db.query(
    `
    SELECT 
      id, title, category, current_price, source,
      ROUND(((current_price - LAG(current_price) OVER (ORDER BY updated_at DESC)) / NULLIF(LAG(current_price) OVER (ORDER BY updated_at DESC), 0)) * 100, 2) as price_change_percent,
      volume_24h,
      url
    FROM markets
    WHERE updated_at > NOW() - INTERVAL '${timeframe}'
    ORDER BY ABS(price_change_percent) DESC
    LIMIT 20
    `
  )
  return result.rows
}

/**
 * Get trending markets (high volume)
 */
export async function getTrendingMarkets() {
  const result = await db.query(
    `
    SELECT 
      id, title, category, current_price, source,
      volume_24h, liquidity, url
    FROM markets
    WHERE volume_24h > 0
    ORDER BY volume_24h DESC
    LIMIT 20
    `
  )
  return result.rows
}

/**
 * Search markets by title/category
 */
export async function searchMarkets(query: string, category?: string) {
  let sql = `
    SELECT * FROM markets
    WHERE title ILIKE $1 OR description ILIKE $1
  `
  const params: any[] = [`%${query}%`]

  if (category) {
    sql += ` AND category = $${params.length + 1}`
    params.push(category)
  }

  sql += ` ORDER BY volume_24h DESC LIMIT 50`

  const result = await db.query(sql, params)
  return result.rows
}
