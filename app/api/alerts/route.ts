import { fetchPolymarketMarkets } from '@/lib/polymarket-client'
import { fetchKalshiMarkets } from '@/lib/kalshi-client'
import { detectArbitrageOpportunities } from '@/lib/arbitrage-engine'
import {
  getAlertPreference,
  shouldTriggerAlert,
  createAlertNotification,
  sendAlertNotification,
} from '@/lib/alerts-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, minSpread = 2 } = body

    if (!userId) {
      return Response.json(
        { success: false, error: 'userId required' },
        { status: 400 }
      )
    }

    // Get user's alert preferences
    const preference = getAlertPreference(userId)
    if (!preference) {
      return Response.json(
        { success: false, error: 'No alert preferences configured' },
        { status: 404 }
      )
    }

    // Fetch markets
    let polymarkets: any[] = []
    let kalshiMarkets: any[] = []

    try {
      ;[polymarkets, kalshiMarkets] = await Promise.all([
        fetchPolymarketMarkets(200).catch(() => []),
        fetchKalshiMarkets(200).catch(() => []),
      ])
    } catch (error) {
      console.error('[alerts] Market fetch error:', error)
      return Response.json(
        { success: false, error: 'Failed to fetch markets' },
        { status: 500 }
      )
    }

    // Normalize and detect opportunities
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
      yesPrice: m.yes_price || 0.5,
      noPrice: m.no_price || 0.5,
      liquidity: m.liquidity || 0,
      volume24h: m.volume24h || 0,
    }))

    const opportunities = detectArbitrageOpportunities(polymarketPrices, kalshiPrices)

    // Filter and check which should trigger alerts
    const triggeredAlerts = []

    for (const opportunity of opportunities) {
      if (shouldTriggerAlert(opportunity, preference)) {
        const notification = createAlertNotification(
          userId,
          opportunity,
          preference.channels
        )

        const sent = await sendAlertNotification(notification, preference)

        triggeredAlerts.push({
          opportunity,
          notification,
          sent,
        })

        console.log(
          `[alerts] Alert triggered for ${opportunity.title}: ${opportunity.spreadPercentage.toFixed(2)}% spread`
        )
      }
    }

    return Response.json({
      success: true,
      triggeredAlerts: triggeredAlerts.length,
      alerts: triggeredAlerts.map((a) => ({
        title: a.opportunity.title,
        spread: a.opportunity.spreadPercentage,
        profitMargin: a.opportunity.profitMargin,
        sent: a.sent,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[alerts] Error:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process alerts',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to get user's current alerts configuration
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return Response.json(
        { success: false, error: 'userId required' },
        { status: 400 }
      )
    }

    const { getAlertPreference } = await import('@/lib/alerts-service')
    const preference = getAlertPreference(userId)

    if (!preference) {
      // Return default preferences if none exist
      return Response.json({
        success: true,
        preference: null,
        defaults: {
          minSpreadPercentage: 2,
          minLiquidityUSD: 10000,
          categories: [],
          channels: ['browser'],
        },
      })
    }

    return Response.json({
      success: true,
      preference,
    })
  } catch (error) {
    console.error('[alerts] GET error:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch alerts',
      },
      { status: 500 }
    )
  }
}
