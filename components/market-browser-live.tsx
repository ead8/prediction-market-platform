'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useRealtime } from '@/hooks/use-realtime'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpRight, Search, Filter, Zap } from 'lucide-react'

interface Market {
  id: string
  title: string
  category: string
  current_price: number
  volume_24h: number
  liquidity: number
  source: 'polymarket' | 'kalshi'
  outcomes?: any[]
}

interface PriceUpdate {
  [key: string]: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface MarketBrowserProps {
  externalCategory?: string
  externalSearch?: string
}

// "Mode" navs from the top bar that translate into a `type` param rather than a category filter.
const MODE_NAVS = new Set(['trending', 'new'])

export function MarketBrowserWithLiveUpdates({
  externalCategory,
  externalSearch,
}: MarketBrowserProps = {}) {
  const [localSearch, setLocalSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('volume')
  const [type, setType] = useState('all')
  const [priceUpdates, setPriceUpdates] = useState<PriceUpdate>({})
  const [trendingMarkets, setTrendingMarkets] = useState<any[]>([])
  // Render timestamp only after mount — avoids SSR/client time mismatch.
  const [lastUpdated, setLastUpdated] = useState<string>('')
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString())
    const id = setInterval(
      () => setLastUpdated(new Date().toLocaleTimeString()),
      30_000,
    )
    return () => clearInterval(id)
  }, [])

  // External (top-of-page) controls override local controls when present.
  const search = externalSearch || localSearch
  const effectiveCategory = (() => {
    if (externalCategory && !MODE_NAVS.has(externalCategory)) return externalCategory
    return selectedCategory
  })()
  const effectiveType = (() => {
    if (externalCategory === 'trending') return 'trending'
    if (externalCategory === 'new') return 'new'
    return type
  })()

  const queryParams = new URLSearchParams()

  // Always include type
  queryParams.set('type', effectiveType)

  // Add search query if present
  if (search) {
    queryParams.set('type', 'search')
    queryParams.set('q', search)
  }

  // Add category filter (even with 'all' type, we can filter by category)
  if (effectiveCategory !== 'all') {
    queryParams.set('category', effectiveCategory)
  }

  const { data, isLoading, error } = useSWR(
    `/api/markets?${queryParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  )

  // Subscribe to real-time updates
  const { connected, subscribeToCategory, subscribeTrending } = useRealtime({
    onUpdate: (update) => {
      setPriceUpdates((prev) => ({
        ...prev,
        [update.id]: update.currentPrice,
      }))
    },
    onTrendingUpdate: (markets) => {
      setTrendingMarkets(markets)
    },
  })

  // Subscribe to category when it changes
  useEffect(() => {
    if (connected && selectedCategory !== 'all') {
      subscribeToCategory(selectedCategory)
    }
  }, [connected, selectedCategory, subscribeToCategory])

  // Subscribe to trending when type changes
  useEffect(() => {
    if (connected && type === 'trending') {
      subscribeTrending()
    }
  }, [connected, type, subscribeTrending])

  const markets: Market[] = (data?.markets || []).map((m: any) => ({
    id: m.id || '',
    title: m.title || 'Unknown Market',
    category: m.category || 'General',
    current_price: m.current_price ?? m.price ?? 0.5,
    volume_24h: m.volume_24h ?? m.volume ?? 0,
    liquidity: m.liquidity ?? 0,
    source: m.source === 'kalshi' ? 'kalshi' : 'polymarket',
    outcomes: m.outcomes || m.outcomePrices,
  }))
  
  // Extract unique categories from markets
  const uniqueCategories = Array.from(
    new Set(markets.map((m) => m.category.toLowerCase()))
  ).sort()
  
  const categories = ['all', ...uniqueCategories]

  const sortedMarkets = [...markets]
    .map((market) => ({
      ...market,
      current_price: priceUpdates[market.id] ?? market.current_price,
    }))
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.volume_24h - a.volume_24h
        case 'price':
          return b.current_price - a.current_price
        case 'liquidity':
          return b.liquidity - a.liquidity
        default:
          return 0
      }
    })

  const showLocalSearch = !externalSearch

  return (
    <div className="w-full h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {externalCategory && externalCategory !== 'all'
              ? `${externalCategory.charAt(0).toUpperCase()}${externalCategory.slice(1)} Markets`
              : 'Prediction Markets'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time market data from Polymarket &amp; Kalshi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-primary pulse-dot' : 'bg-destructive'
            }`}
          ></div>
          <span className="text-sm text-muted-foreground">
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        {showLocalSearch && (
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search markets..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-10 glass text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button
              variant="outline"
              className="glass hover:text-primary"
            >
              <Filter className="w-4 h-4 mr-2" />
              Advanced
            </Button>
          </div>
        )}

        {/* Sub-category chips derived from current data */}
        {!externalCategory && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant="outline"
                onClick={() => setSelectedCategory(cat)}
                className={`capitalize whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'glass'
                }`}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}

        {/* View Options */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setType('all')}
              className={
                effectiveType === 'all'
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'glass'
              }
            >
              All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setType('trending')}
              className={
                effectiveType === 'trending'
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'glass'
              }
            >
              Trending
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setType('movers')}
              className={
                effectiveType === 'movers'
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'glass'
              }
            >
              Top Movers
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-muted-foreground">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="glass text-foreground rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="volume">Volume</option>
              <option value="price">Price</option>
              <option value="liquidity">Liquidity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Markets Table */}
      <div className="flex-1 overflow-auto">
        {isLoading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="glass p-4 border">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-20 rounded-full" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <div className="text-right space-y-1">
                    <Skeleton className="h-5 w-16 ml-auto" />
                    <Skeleton className="h-3 w-12 ml-auto" />
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-5 w-16 ml-auto" />
                    <Skeleton className="h-3 w-12 ml-auto" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-destructive">Failed to load markets</div>
          </div>
        ) : sortedMarkets.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">No markets found</div>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMarkets.map((market) => {
              const isUpdated = priceUpdates[market.id] !== undefined
              const yesCents = Math.round((market.current_price || 0) * 100)
              return (
                <Card
                  key={market.id}
                  className={`glass p-4 border transition-all ${
                    isUpdated ? 'border-primary/60' : ''
                  } hover:border-primary/50 cursor-pointer group`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Market Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {market.title}
                        </h3>
                        {isUpdated && (
                          <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
                          {market.category}
                        </span>
                        <span className="text-muted-foreground">
                          {market.source === 'polymarket'
                            ? 'Polymarket'
                            : 'Kalshi'}
                        </span>
                      </div>
                    </div>

                    {/* Yes price chip — Polymarket-style */}
                    <div className="text-right">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 text-primary border border-primary/40 font-semibold">
                        Yes {yesCents}¢
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Price
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        ${((market.volume_24h || 0) / 1000).toFixed(1)}K
                      </div>
                      <div className="text-xs text-muted-foreground">
                        24h Vol
                      </div>
                    </div>

                    {/* Liquidity */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        ${((market.liquidity || 0) / 1000).toFixed(1)}K
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Liquidity
                      </div>
                    </div>

                    <div className="text-muted-foreground group-hover:text-primary transition-colors">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground" suppressHydrationWarning>
        Showing {sortedMarkets.length} of {markets.length} markets
        {lastUpdated && <> • Last updated: {lastUpdated}</>}
      </div>
    </div>
  )
}
