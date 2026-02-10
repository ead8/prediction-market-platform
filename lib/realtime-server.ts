import { Server } from 'socket.io'
import { aggregateAndSyncMarkets } from './market-aggregator'
import { db } from './db'

export interface MarketUpdate {
  id: string
  currentPrice: number
  volume24h: number
  liquidity: number
  timestamp: number
  source: 'polymarket' | 'kalshi'
}

class RealtimeServer {
  private io: Server | null = null
  private syncInterval: NodeJS.Timeout | null = null
  private lastPrices: Map<string, number> = new Map()

  init(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
    })

    this.setupConnections()
    this.startSyncLoop()

    console.log('[realtime] WebSocket server initialized')
    return this.io
  }

  private setupConnections() {
    this.io?.on('connection', (socket) => {
      console.log('[realtime] Client connected:', socket.id)

      // Client subscribes to specific markets
      socket.on('subscribe_market', (marketId: string) => {
        socket.join(`market:${marketId}`)
        console.log(`[realtime] Client subscribed to market ${marketId}`)
      })

      socket.on('unsubscribe_market', (marketId: string) => {
        socket.leave(`market:${marketId}`)
        console.log(`[realtime] Client unsubscribed from market ${marketId}`)
      })

      // Subscribe to market category updates
      socket.on('subscribe_category', (category: string) => {
        socket.join(`category:${category}`)
        console.log(`[realtime] Client subscribed to category ${category}`)
      })

      // Subscribe to trending/movers
      socket.on('subscribe_trending', () => {
        socket.join('trending')
        console.log(`[realtime] Client subscribed to trending markets`)
      })

      socket.on('subscribe_movers', () => {
        socket.join('movers')
        console.log(`[realtime] Client subscribed to top movers`)
      })

      socket.on('disconnect', () => {
        console.log('[realtime] Client disconnected:', socket.id)
      })
    })
  }

  private async startSyncLoop() {
    // Sync markets every 5 seconds
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAndBroadcast()
      } catch (error) {
        console.error('[realtime] Sync error:', error)
      }
    }, 5000)
  }

  private async syncAndBroadcast() {
    try {
      // Fetch latest market data
      const markets = await aggregateAndSyncMarkets()

      for (const market of markets) {
        const lastPrice = this.lastPrices.get(market.id) || market.currentPrice
        const priceChange =
          ((market.currentPrice - lastPrice) / lastPrice) * 100

        const update: MarketUpdate = {
          id: market.id,
          currentPrice: market.currentPrice,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
          timestamp: Date.now(),
          source: market.source,
        }

        // Broadcast to specific market subscribers
        this.io?.to(`market:${market.id}`).emit('market_update', {
          ...update,
          priceChange,
        })

        // Broadcast to category subscribers
        this.io?.to(`category:${market.category}`).emit('market_update', update)

        // Update last price for next comparison
        this.lastPrices.set(market.id, market.currentPrice)
      }

      // Broadcast trending markets
      const trendingResult = await db.query(`
        SELECT id, title, category, current_price, volume_24h, source
        FROM markets
        ORDER BY volume_24h DESC
        LIMIT 20
      `)

      this.io?.to('trending').emit('trending_update', trendingResult.rows)

      // Broadcast top movers
      const moversResult = await db.query(`
        SELECT 
          id, title, category, current_price, source,
          ROUND(((current_price - LAG(current_price) OVER (ORDER BY updated_at DESC)) / NULLIF(LAG(current_price) OVER (ORDER BY updated_at DESC), 0)) * 100, 2) as price_change_percent
        FROM markets
        WHERE updated_at > NOW() - INTERVAL '24h'
        ORDER BY ABS(price_change_percent) DESC
        LIMIT 20
      `)

      this.io?.to('movers').emit('movers_update', moversResult.rows)

      console.log('[realtime] Broadcast complete:', markets.length, 'markets')
    } catch (error) {
      console.error('[realtime] Broadcast error:', error)
    }
  }

  broadcast(event: string, data: any) {
    this.io?.emit(event, data)
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    this.io?.close()
    console.log('[realtime] WebSocket server stopped')
  }
}

export const realtimeServer = new RealtimeServer()
