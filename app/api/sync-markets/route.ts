import { aggregateAndSyncMarkets } from '@/lib/market-aggregator'

export async function GET(request: Request) {
  try {
    const markets = await aggregateAndSyncMarkets()

    return Response.json({
      success: true,
      count: markets.length,
      markets,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[sync-markets] Error:', error)
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to sync markets',
      },
      { status: 500 }
    )
  }
}
