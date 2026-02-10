import { fetchPolymarketMarkets, fetchPolymarketTrendingMarkets } from '@/lib/polymarket-client'
import { fetchKalshiMarkets, fetchKalshiTrendingMarkets } from '@/lib/kalshi-client'
import { MOCK_MARKETS } from '@/lib/mock-data'

function getMockAnalytics() {
  const stats = {
    total_markets: MOCK_MARKETS.length,
    polymarket_count: MOCK_MARKETS.filter((m) => m.source === 'polymarket')
      .length,
    kalshi_count: MOCK_MARKETS.filter((m) => m.source === 'kalshi').length,
    avg_price: (
      MOCK_MARKETS.reduce(
        (sum, m) => sum + (m.yes_price + m.no_price) / 2,
        0
      ) / MOCK_MARKETS.length
    ).toFixed(2),
    total_volume_24h: MOCK_MARKETS.reduce((sum, m) => sum + m.volume_24h, 0),
    avg_volume_24h: Math.round(
      MOCK_MARKETS.reduce((sum, m) => sum + m.volume_24h, 0) / MOCK_MARKETS.length
    ),
  }

  const categories = Array.from(new Set(MOCK_MARKETS.map((m) => m.category)))
    .map((cat) => {
      const catMarkets = MOCK_MARKETS.filter((m) => m.category === cat)
      return {
        category: cat,
        market_count: catMarkets.length,
        category_volume: catMarkets.reduce((sum, m) => sum + m.volume_24h, 0),
        avg_price: (
          catMarkets.reduce((sum, m) => sum + (m.yes_price + m.no_price) / 2, 0) /
          catMarkets.length
        ).toFixed(2),
      }
    })
    .sort((a, b) => b.category_volume - a.category_volume)

  const trending = [...MOCK_MARKETS]
    .sort((a, b) => b.volume_24h - a.volume_24h)
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      last_price: ((m.yes_price + m.no_price) / 2).toFixed(4),
      volume_24h: m.volume_24h,
      source: m.source,
      price: ((m.yes_price + m.no_price) / 2).toFixed(4),
    }))

  const movers = [...MOCK_MARKETS]
    .map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      last_price: ((m.yes_price + m.no_price) / 2).toFixed(4),
      source: m.source,
      price_change_percent: (Math.random() * 20 - 10).toFixed(2),
    }))
    .sort((a, b) => Math.abs(parseFloat(b.price_change_percent)) - Math.abs(parseFloat(a.price_change_percent)))
    .slice(0, 10)

  const distribution = [
    { price_range: '0-0.2', market_count: 1, avg_volume: 800000 },
    { price_range: '0.2-0.4', market_count: 1, avg_volume: 950000 },
    { price_range: '0.4-0.6', market_count: 3, avg_volume: 1200000 },
    { price_range: '0.6-0.8', market_count: 2, avg_volume: 1600000 },
    { price_range: '0.8-1.0', market_count: 1, avg_volume: 450000 },
  ]

  return {
    stats,
    trending,
    movers,
    categories,
    distribution,
  }
}

export async function GET() {
  try {
    let source = 'mixed'
    let polymarkets: any[] = []
    let kalshiMarkets: any[] = []

    try {
      // Fetch from both exchanges in parallel
      ;[polymarkets, kalshiMarkets] = await Promise.all([
        fetchPolymarketMarkets(200).catch((err) => {
          console.warn('[analytics] Polymarket fetch failed:', err)
          return []
        }),
        fetchKalshiMarkets(200).catch((err) => {
          console.warn('[analytics] Kalshi fetch failed:', err)
          return []
        }),
      ])

      console.log(
        `[analytics] Fetched ${polymarkets.length} Polymarket + ${kalshiMarkets.length} Kalshi markets`
      )
    } catch (apiError) {
      console.warn('[analytics] API failed, using mock data:', apiError)
      source = 'mock'
      return Response.json(getMockAnalytics(), { status: 200 })
    }

    // Combine markets
    const allMarkets = [
      ...polymarkets.map((m) => ({ ...m, source: 'polymarket' })),
      ...kalshiMarkets.map((m) => ({ ...m, source: 'kalshi' })),
    ]

    // Calculate statistics
    const stats = {
      total_markets: allMarkets.length,
      polymarket_count: polymarkets.length,
      kalshi_count: kalshiMarkets.length,
      avg_price: (
        allMarkets.reduce((sum, m) => sum + (m.price || m.bestBid || 0.5), 0) /
        allMarkets.length
      ).toFixed(2),
      total_volume_24h: Math.round(
        allMarkets.reduce((sum, m) => sum + (m.volume24h || 0), 0)
      ),
      avg_volume_24h: Math.round(
        allMarkets.reduce((sum, m) => sum + (m.volume24h || 0), 0) / allMarkets.length
      ),
    }

    // Category breakdown
    const categoryMap = new Map<string, any[]>()
    allMarkets.forEach((m) => {
      const cat = m.category || 'Other'
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, [])
      }
      categoryMap.get(cat)!.push(m)
    })

    const categories = Array.from(categoryMap.entries())
      .map(([category, catMarkets]) => ({
        category,
        market_count: catMarkets.length,
        category_volume: Math.round(
          catMarkets.reduce((sum, m) => sum + (m.volume24h || 0), 0)
        ),
        avg_price: (
          catMarkets.reduce((sum, m) => sum + (m.price || m.bestBid || 0.5), 0) /
          catMarkets.length
        ).toFixed(2),
      }))
      .sort((a, b) => b.category_volume - a.category_volume)

    // Trending markets
    const trending = allMarkets
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        title: m.title,
        category: m.category,
        last_price: (m.price || m.bestBid || 0.5).toFixed(4),
        volume_24h: m.volume24h || 0,
        source: m.source,
        price: (m.price || m.bestBid || 0.5).toFixed(4),
      }))

    // Top movers (simulate price changes)
    const movers = allMarkets
      .map((m) => ({
        id: m.id,
        title: m.title,
        category: m.category,
        last_price: (m.price || m.bestBid || 0.5).toFixed(4),
        source: m.source,
        price_change_percent: (Math.random() * 20 - 10).toFixed(2),
      }))
      .sort(
        (a, b) =>
          Math.abs(parseFloat(b.price_change_percent)) -
          Math.abs(parseFloat(a.price_change_percent))
      )
      .slice(0, 10)

    // Price distribution
    const distribution = [
      { price_range: '0-0.2', market_count: 0, avg_volume: 0 },
      { price_range: '0.2-0.4', market_count: 0, avg_volume: 0 },
      { price_range: '0.4-0.6', market_count: 0, avg_volume: 0 },
      { price_range: '0.6-0.8', market_count: 0, avg_volume: 0 },
      { price_range: '0.8-1.0', market_count: 0, avg_volume: 0 },
    ]

    allMarkets.forEach((m) => {
      const price = m.price || m.bestBid || 0.5
      const volume = m.volume24h || 0
      if (price < 0.2) {
        distribution[0].market_count++
        distribution[0].avg_volume = (distribution[0].avg_volume + volume) / 2
      } else if (price < 0.4) {
        distribution[1].market_count++
        distribution[1].avg_volume = (distribution[1].avg_volume + volume) / 2
      } else if (price < 0.6) {
        distribution[2].market_count++
        distribution[2].avg_volume = (distribution[2].avg_volume + volume) / 2
      } else if (price < 0.8) {
        distribution[3].market_count++
        distribution[3].avg_volume = (distribution[3].avg_volume + volume) / 2
      } else {
        distribution[4].market_count++
        distribution[4].avg_volume = (distribution[4].avg_volume + volume) / 2
      }
    })

    return Response.json({
      success: true,
      trending,
      movers,
      stats,
      categories,
      distribution,
      timestamp: new Date().toISOString(),
      source,
    })
  } catch (error) {
    console.error('[analytics] Error:', error)
    // Fallback to mock data on error
    const mockAnalytics = getMockAnalytics()
    return Response.json({
      success: true,
      trending: mockAnalytics.trending,
      movers: mockAnalytics.movers,
      stats: mockAnalytics.stats,
      categories: mockAnalytics.categories,
      distribution: mockAnalytics.distribution,
      timestamp: new Date().toISOString(),
      source: 'mock-fallback',
    })
  }
}
