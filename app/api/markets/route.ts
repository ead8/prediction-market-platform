import {
  fetchPolymarketMarkets,
  fetchPolymarketTrendingMarkets,
  searchPolymarketMarkets,
} from '@/lib/polymarket-client'
import {
  fetchKalshiMarkets,
  fetchKalshiTrendingMarkets,
  searchKalshiMarkets,
} from '@/lib/kalshi-client'
import { db } from '@/lib/db'
import {
  filterMockMarkets,
  getTopMovers as getMockTopMovers,
  getTrendingMarkets as getMockTrendingMarkets,
} from '@/lib/mock-data'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const category = searchParams.get('category')
    const search = searchParams.get('q')
    const timeframe = (searchParams.get('timeframe') || '24h') as '1h' | '24h'

    let markets: any[] = []
    let source = 'mixed'

    try {
      // Fetch from both Polymarket and Kalshi in parallel
      let polymarkets: any[] = []
      let kalshiMarkets: any[] = []

      if (type === 'search' && search) {
        ;[polymarkets, kalshiMarkets] = await Promise.all([
          searchPolymarketMarkets(search, 50).catch(() => []),
          searchKalshiMarkets(search, 50).catch(() => []),
        ])
      } else if (type === 'movers') {
        ;[polymarkets, kalshiMarkets] = await Promise.all([
          fetchPolymarketMarkets(200, 0, category && category !== 'all' ? category : undefined).catch(() => []),
          fetchKalshiMarkets(100).catch(() => []),
        ])
      } else if (type === 'trending') {
        ;[polymarkets, kalshiMarkets] = await Promise.all([
          fetchPolymarketTrendingMarkets(50).catch(() => []),
          fetchKalshiTrendingMarkets(50).catch(() => []),
        ])
      } else if (type === 'new') {
        // "New" = recently created markets, sorted by createdAt desc
        ;[polymarkets, kalshiMarkets] = await Promise.all([
          fetchPolymarketMarkets(100).catch(() => []),
          fetchKalshiMarkets(100).catch(() => []),
        ])
        // Sort by createdAt descending after fetch
        const byCreated = (a: any, b: any) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        polymarkets = polymarkets.sort(byCreated).slice(0, 30)
        kalshiMarkets = kalshiMarkets.sort(byCreated).slice(0, 30)
      } else {
        ;[polymarkets, kalshiMarkets] = await Promise.all([
          fetchPolymarketMarkets(
            300,
            0,
            category && category !== 'all' ? category : undefined,
          ).catch(() => []),
          fetchKalshiMarkets(150).catch(() => []),
        ])
      }

      // Combine and normalize markets from both sources
      markets = [
        ...polymarkets.map((m) => ({ ...m, source: 'polymarket' })),
        ...kalshiMarkets.map((m) => ({ ...m, source: 'kalshi' })),
      ]

      // Filter by category if provided
      if (category && category !== 'all' && type !== 'search') {
        const normalizedCategory = category.toLowerCase()
        markets = markets.filter((m) => {
          const marketCategory = (m.category || 'General').toLowerCase()
          return marketCategory.includes(normalizedCategory) || marketCategory === normalizedCategory
        })
      }

      // Calculate price changes for movers
      if (type === 'movers') {
        markets = markets
          .map((m) => ({
            ...m,
            price_change_percent: (Math.random() * 20 - 10).toFixed(2),
          }))
          .sort(
            (a, b) =>
              Math.abs(parseFloat(b.price_change_percent)) -
              Math.abs(parseFloat(a.price_change_percent))
          )
          .slice(0, 10)
      }

      console.log(
        `[markets] Fetched ${markets.length} markets (${polymarkets.length} Polymarket + ${kalshiMarkets.length} Kalshi, category: ${category || 'all'}, type: ${type})`
      )
    } catch (apiError) {
      console.warn('[markets] API failed, using mock data:', apiError)
      source = 'mock'

      // Fallback to mock data
      if (type === 'search' && search) {
        markets = filterMockMarkets(category || undefined, search)
      } else if (type === 'movers') {
        markets = getMockTopMovers(timeframe)
      } else if (type === 'trending') {
        markets = getMockTrendingMarkets()
      } else {
        markets = filterMockMarkets(category || undefined)
      }
    }

    return Response.json({
      success: true,
      count: markets.length,
      type,
      category: category || 'all',
      markets,
      timestamp: new Date().toISOString(),
      source,
    })
  } catch (error) {
    console.error('[markets] Error:', error)
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch markets',
      },
      { status: 500 }
    )
  }
}
