'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export interface MarketUpdate {
  id: string
  currentPrice: number
  volume24h: number
  liquidity: number
  timestamp: number
  source: 'polymarket' | 'kalshi'
  priceChange?: number
}

interface UseRealtimeOptions {
  autoConnect?: boolean
  onUpdate?: (update: MarketUpdate) => void
  onTrendingUpdate?: (markets: any[]) => void
  onMoversUpdate?: (markets: any[]) => void
  onError?: (error: Error) => void
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const {
    autoConnect = true,
    onUpdate,
    onTrendingUpdate,
    onMoversUpdate,
    onError,
  } = options

  useEffect(() => {
    if (!autoConnect) return

    try {
      const socket = io(undefined, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      socket.on('connect', () => {
        console.log('[realtime] Connected to WebSocket')
        setConnected(true)
        setError(null)
      })

      socket.on('disconnect', () => {
        console.log('[realtime] Disconnected from WebSocket')
        setConnected(false)
      })

      socket.on('market_update', (update: MarketUpdate) => {
        onUpdate?.(update)
      })

      socket.on('trending_update', (markets: any[]) => {
        onTrendingUpdate?.(markets)
      })

      socket.on('movers_update', (markets: any[]) => {
        onMoversUpdate?.(markets)
      })

      socket.on('error', (err: any) => {
        const error = new Error(err.message || 'WebSocket error')
        setError(error)
        onError?.(error)
      })

      socketRef.current = socket
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    }

    return () => {
      socketRef.current?.disconnect()
    }
  }, [autoConnect, onUpdate, onTrendingUpdate, onMoversUpdate, onError])

  const subscribeToMarket = useCallback((marketId: string) => {
    socketRef.current?.emit('subscribe_market', marketId)
  }, [])

  const unsubscribeFromMarket = useCallback((marketId: string) => {
    socketRef.current?.emit('unsubscribe_market', marketId)
  }, [])

  const subscribeToCategory = useCallback((category: string) => {
    socketRef.current?.emit('subscribe_category', category)
  }, [])

  const subscribeTrending = useCallback(() => {
    socketRef.current?.emit('subscribe_trending')
  }, [])

  const subscribeMovers = useCallback(() => {
    socketRef.current?.emit('subscribe_movers')
  }, [])

  return {
    connected,
    error,
    subscribeToMarket,
    unsubscribeFromMarket,
    subscribeToCategory,
    subscribeTrending,
    subscribeMovers,
  }
}
