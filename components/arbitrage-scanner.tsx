'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, TrendingUpIcon } from 'lucide-react'

interface ArbitrageOpportunity {
  id: string
  title: string
  category: string
  buyExchange: 'polymarket' | 'kalshi'
  sellExchange: 'polymarket' | 'kalshi'
  buyPrice: number
  sellPrice: number
  spreadPercentage: number
  spreadAbsolute: number
  profitMargin: number
  minLiquidity: number
  confidence: 'high' | 'medium' | 'low'
  detectedAt: string
}

export function ArbitrageScanner() {
  const [minSpread, setMinSpread] = useState(2)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [categories, setCategories] = useState<string[]>(['all'])

  const queryParams = new URLSearchParams({
    minSpread: String(minSpread),
    ...(selectedCategory !== 'all' && { category: selectedCategory }),
  })

  const { data, isLoading, error } = useSWR(
    `/api/arbitrage?${queryParams.toString()}`,
    (url) => fetch(url).then((res) => res.json()),
    { refreshInterval: 5000 } // Refresh every 5 seconds
  )

  const opportunities: ArbitrageOpportunity[] = data?.opportunities || []
  const stats = data?.stats || {}

  // Extract categories from opportunities
  useEffect(() => {
    if (opportunities.length > 0) {
      const uniqueCategories = Array.from(
        new Set(opportunities.map((o) => o.category.toLowerCase()))
      ).sort()
      setCategories(['all', ...uniqueCategories])
    }
  }, [opportunities])

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-chart-2 text-white'
      case 'medium':
        return 'bg-chart-3 text-white'
      case 'low':
        return 'bg-chart-4 text-white'
      default:
        return 'bg-muted text-foreground'
    }
  }

  const getExchangeColor = (exchange: string) => {
    return exchange === 'polymarket'
      ? 'bg-blue-900/20 text-chart-1'
      : 'bg-purple-900/20 text-chart-5'
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUpIcon className="w-6 h-6 text-chart-2" />
          <h2 className="text-2xl font-bold">Arbitrage Opportunities</h2>
        </div>
        <p className="text-muted-foreground">
          Real-time cross-exchange spread detection for profitable trading
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Polymarket</div>
            <div className="text-2xl font-bold">{stats.polymarket_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Kalshi</div>
            <div className="text-2xl font-bold">{stats.kalshi_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Matched</div>
            <div className="text-2xl font-bold">{stats.matched_markets || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Opportunities</div>
            <div className="text-2xl font-bold text-chart-2">
              {opportunities.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Minimum Spread</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="20"
                value={minSpread}
                onChange={(e) => setMinSpread(parseInt(e.target.value))}
                className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-bold text-chart-2 w-12">
                {minSpread}%
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="capitalize"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Scanning for arbitrage opportunities...
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-chart-4">
          <CardContent className="pt-6 text-center text-chart-4">
            Failed to scan markets. Retrying...
          </CardContent>
        </Card>
      )}

      {/* Opportunities List */}
      {!isLoading && opportunities.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No arbitrage opportunities found. Try lowering the minimum spread or wait for
            new opportunities.
          </CardContent>
        </Card>
      )}

      {opportunities.map((opp) => (
        <Card
          key={opp.id}
          className={`border-l-4 transition-all hover:shadow-lg ${
            opp.confidence === 'high'
              ? 'border-l-chart-2 bg-chart-2/5'
              : opp.confidence === 'medium'
                ? 'border-l-chart-3 bg-chart-3/5'
                : 'border-l-chart-4 bg-chart-4/5'
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg text-pretty">{opp.title}</CardTitle>
                <CardDescription className="capitalize mt-1">
                  {opp.category}
                </CardDescription>
              </div>
              <div className={`px-3 py-1 rounded text-xs font-bold ${getConfidenceColor(opp.confidence)}`}>
                {opp.confidence.toUpperCase()} {opp.spreadPercentage.toFixed(2)}%
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Exchange Flow */}
            <div className="flex items-center justify-between gap-2 p-3 bg-secondary/50 rounded-lg">
              <div className="flex-1 space-y-1">
                <div className="text-xs text-muted-foreground">BUY</div>
                <div
                  className={`px-2 py-1 rounded text-sm font-bold inline-block ${getExchangeColor(opp.buyExchange)}`}
                >
                  {opp.buyExchange}
                </div>
                <div className="text-lg font-bold mt-1">
                  ${opp.buyPrice.toFixed(4)}
                </div>
              </div>

              <ArrowRightIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />

              <div className="flex-1 space-y-1 text-right">
                <div className="text-xs text-muted-foreground">SELL</div>
                <div
                  className={`px-2 py-1 rounded text-sm font-bold inline-block ${getExchangeColor(opp.sellExchange)}`}
                >
                  {opp.sellExchange}
                </div>
                <div className="text-lg font-bold mt-1">
                  ${opp.sellPrice.toFixed(4)}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 p-2 bg-secondary/30 rounded">
                <div className="text-xs text-muted-foreground">Spread</div>
                <div className="text-lg font-bold text-chart-2">
                  {opp.spreadPercentage.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  ${opp.spreadAbsolute.toFixed(4)}
                </div>
              </div>

              <div className="space-y-1 p-2 bg-secondary/30 rounded">
                <div className="text-xs text-muted-foreground">Profit Margin</div>
                <div className="text-lg font-bold text-accent">
                  {opp.profitMargin.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  after fees
                </div>
              </div>

              <div className="space-y-1 p-2 bg-secondary/30 rounded">
                <div className="text-xs text-muted-foreground">Liquidity</div>
                <div className="text-lg font-bold text-chart-1">
                  ${(opp.minLiquidity / 1000).toFixed(0)}K
                </div>
                <div className="text-xs text-muted-foreground">
                  available
                </div>
              </div>
            </div>

            {/* Execute Button */}
            <Button className="w-full bg-chart-2 hover:bg-chart-2/90 text-white font-bold">
              Execute Trade
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
