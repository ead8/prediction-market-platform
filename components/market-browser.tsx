'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Search,
  Filter,
} from 'lucide-react'

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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function MarketBrowser() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('volume')
  const [type, setType] = useState('all')

  const queryParams = new URLSearchParams({
    ...(search && { type: 'search', q: search }),
    ...(selectedCategory !== 'all' && { category: selectedCategory }),
    ...(type !== 'all' && { type }),
  })

  const { data, isLoading, error } = useSWR(
    `/api/markets?${queryParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  )

  const markets: Market[] = data?.markets || []
  const categories = ['all', 'politics', 'sports', 'crypto', 'tech', 'economics']

  const sortedMarkets = [...markets].sort((a, b) => {
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

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Prediction Markets
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time market data from Polymarket & Kalshi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
          <span className="text-sm text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-secondary text-foreground border-border placeholder-muted-foreground"
            />
          </div>
          <Button
            variant="outline"
            className="border-border hover:bg-secondary bg-transparent"
          >
            <Filter className="w-4 h-4 mr-2" />
            Advanced
          </Button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={`capitalize whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-secondary'
              }`}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* View Options */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-2">
            <Button
              variant={type === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('all')}
              className={
                type === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'border-border'
              }
            >
              All
            </Button>
            <Button
              variant={type === 'trending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('trending')}
              className={
                type === 'trending'
                  ? 'bg-primary text-primary-foreground'
                  : 'border-border'
              }
            >
              Trending
            </Button>
            <Button
              variant={type === 'movers' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('movers')}
              className={
                type === 'movers'
                  ? 'bg-primary text-primary-foreground'
                  : 'border-border'
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
              className="bg-secondary text-foreground border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading markets...</div>
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
            {sortedMarkets.map((market) => (
              <Card
                key={market.id}
                className="p-4 bg-card border-border hover:border-primary cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Market Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {market.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="px-2 py-1 bg-secondary text-muted-foreground rounded">
                            {market.category}
                          </span>
                          <span className="text-muted-foreground">
                            {market.source === 'polymarket'
                              ? 'Polymarket'
                              : 'Kalshi'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">
                      ${market.current_price.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Price
                    </div>
                  </div>

                  {/* Volume */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-chart-2">
                      ${(market.volume_24h / 1000).toFixed(1)}K
                    </div>
                    <div className="text-xs text-muted-foreground">
                      24h Vol
                    </div>
                  </div>

                  {/* Liquidity */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-chart-1">
                      ${(market.liquidity / 1000).toFixed(1)}K
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Liquidity
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-muted-foreground group-hover:text-primary transition-colors">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground">
        Showing {sortedMarkets.length} of {markets.length} markets • Last
        updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}
