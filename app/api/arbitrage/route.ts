import { fetchPolymarketMarkets } from '@/lib/polymarket-client'
import { fetchKalshiMarkets } from '@/lib/kalshi-client'
import { detectArbitrageOpportunities } from '@/lib/arbitrage-engine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const minSpread = parseFloat(searchParams.get('minSpread') || '2')
    const category = searchParams.get('category')

    console.log('[arbitrage] Fetching markets from both exchanges...')

    let polymarkets: any[] = []
    let kalshiMarkets: any[] = []

    try {
      // Fetch from both exchanges in parallel
      ;[polymarkets, kalshiMarkets] = await Promise.all([
        fetchPolymarketMarkets(200).catch((err) => {
          console.warn('[arbitrage] Polymarket fetch failed:', err)
          return []
        }),
        fetchKalshiMarkets(200).catch((err) => {
          console.warn('[arbitrage] Kalshi fetch failed:', err)
          return []
        }),
      ])
    } catch (error) {
      console.error('[arbitrage] Market fetch error:', error)
      return Response.json(
        { success: false, error: 'Failed to fetch market data' },
        { status: 500 }
      )
    }

    // Log sample data to understand field structures
    if (polymarkets.length > 0) {
      const sample = polymarkets[0]
      console.log('[arbitrage] Sample Polymarket:', JSON.stringify({
        id: sample.id,
        title: sample.title?.substring(0, 50),
        price: sample.price,
        bestBid: sample.bestBid,
        bestAsk: sample.bestAsk,
        liquidity: sample.liquidity,
        volume24h: sample.volume24h,
      }))
    }
    if (kalshiMarkets.length > 0) {
      const sample = kalshiMarkets[0]
      console.log('[arbitrage] Sample Kalshi:', JSON.stringify({
        id: sample.id,
        title: sample.title?.substring(0, 50),
        yes_price: sample.yes_price,
        no_price: sample.no_price,
        price: sample.price,
        liquidity: sample.liquidity,
        volume24h: sample.volume24h,
      }))
    }

    // Normalize market data for arbitrage detection
    const polymarketPrices = polymarkets.map((m) => ({
      id: m.id,
      source: 'polymarket' as const,
      title: m.title,
      category: m.category || 'General',
      yesPrice: m.bestBid || m.price || 0.5,
      noPrice: m.bestAsk || (1 - (m.price || 0.5)) || 0.5,
      liquidity: m.liquidity || 0,
      volume24h: m.volume24h || 0,
    }))

    const kalshiPrices = kalshiMarkets.map((m) => ({
      id: m.id,
      source: 'kalshi' as const,
      title: m.title,
      category: m.category || 'General',
      yesPrice: m.yes_price || m.price || 0.5,
      noPrice: m.no_price || (1 - (m.price || 0.5)),
      liquidity: m.liquidity || 0,
      volume24h: m.volume24h || 0,
    }))

    // Detect arbitrage opportunities
    let opportunities = detectArbitrageOpportunities(polymarketPrices, kalshiPrices)

    // Log matching stats
    console.log(`[arbitrage] Pre-filter opportunities: ${opportunities.length}`)

    // Filter by minimum spread
    opportunities = opportunities.filter((opp) => opp.spreadPercentage >= minSpread)

    // Filter by category if provided
    if (category && category !== 'all') {
      opportunities = opportunities.filter((opp) =>
        opp.category.toLowerCase().includes(category.toLowerCase())
      )
    }

    console.log(`[arbitrage] Final opportunities: ${opportunities.length} (minSpread: ${minSpread}%)`)

    return Response.json({
      success: true,
      opportunities,
      stats: {
        polymarket_count: polymarkets.length,
        kalshi_count: kalshiMarkets.length,
        matched_markets: opportunities.length > 0
          ? new Set(opportunities.map((o) => o.polymarketId)).size
          : 0,
        opportunities_count: opportunities.length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[arbitrage] Error:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect arbitrage',
      },
      { status: 500 }
    )
  }
}
