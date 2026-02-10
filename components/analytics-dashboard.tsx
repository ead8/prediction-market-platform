'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface AnalyticsData {
  trending: any[]
  movers: any[]
  stats: {
    total_markets: number
    polymarket_count: number
    kalshi_count: number
    avg_price: number
    total_volume_24h: number
    avg_volume_24h: number
  }
  categories: any[]
  distribution: any[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export function AnalyticsDashboard() {
  const { data, isLoading, error } = useSWR(
    '/api/analytics',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const analytics: AnalyticsData = data || {
    trending: [],
    movers: [],
    stats: {
      total_markets: 0,
      polymarket_count: 0,
      kalshi_count: 0,
      avg_price: 0,
      total_volume_24h: 0,
      avg_volume_24h: 0,
    },
    categories: [],
    distribution: [],
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  const stats = {
    total_markets: analytics.stats?.total_markets || 0,
    polymarket_count: analytics.stats?.polymarket_count || 0,
    kalshi_count: analytics.stats?.kalshi_count || 0,
    avg_price: parseFloat(String(analytics.stats?.avg_price || 0)),
    total_volume_24h: parseFloat(String(analytics.stats?.total_volume_24h || 0)),
    avg_volume_24h: parseFloat(String(analytics.stats?.avg_volume_24h || 0)),
  }

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6 overflow-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Market Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          Real-time statistics and market insights
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Markets</p>
              <p className="text-2xl font-bold text-foreground mt-2">
                {stats.total_markets}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.polymarket_count} Polymarket • {stats.kalshi_count}{' '}
                Kalshi
              </p>
            </div>
            <Activity className="w-8 h-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">24h Volume</p>
              <p className="text-2xl font-bold text-foreground mt-2">
                ${(stats.total_volume_24h / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Avg: ${(stats.avg_volume_24h / 1000).toFixed(1)}K
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-chart-2" />
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Avg Price</p>
              <p className="text-2xl font-bold text-foreground mt-2">
                ${stats.avg_price?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Probability</p>
            </div>
            <Activity className="w-8 h-8 text-chart-1" />
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Sources</p>
              <p className="text-2xl font-bold text-foreground mt-2">2</p>
              <p className="text-xs text-muted-foreground mt-2">
                Polymarket + Kalshi
              </p>
            </div>
            <Activity className="w-8 h-8 text-chart-3" />
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Movers */}
        <Card className="p-4 bg-card border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Top Movers
          </h2>
          <div className="space-y-3">
            {(analytics.movers || []).slice(0, 5).map((market) => (
              <div
                key={market.id}
                className="flex items-center justify-between p-2 rounded hover:bg-secondary transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {market.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {market.source}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {market.price_change_percent >= 0 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-accent" />
                      <span className="text-sm font-bold text-accent">
                        +{market.price_change_percent}%
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-bold text-destructive">
                        {market.price_change_percent}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Category Breakdown */}
        <Card className="p-4 bg-card border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Markets by Category
          </h2>
          {(analytics.categories || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.categories}
                  dataKey="market_count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(analytics.categories || []).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #2d3748',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#e0e0e0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </Card>

        {/* Volume by Category */}
        <Card className="p-4 bg-card border-border lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Volume by Category
          </h2>
          {(analytics.categories || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.categories}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#2d3748"
                  vertical={false}
                />
                <XAxis
                  dataKey="category"
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #2d3748',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#e0e0e0' }}
                />
                <Bar dataKey="category_volume" fill="#3b82f6" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </Card>

        {/* Price Distribution */}
        <Card className="p-4 bg-card border-border lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Price Distribution
          </h2>
          {(analytics.distribution || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.distribution}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#2d3748"
                  vertical={false}
                />
                <XAxis
                  dataKey="price_range"
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #2d3748',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#e0e0e0' }}
                />
                <Bar dataKey="market_count" fill="#10b981" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </Card>
      </div>

      {/* Trending Markets */}
      <Card className="p-4 bg-card border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Trending Markets
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-muted-foreground font-medium">
                  Market
                </th>
                <th className="text-right p-2 text-muted-foreground font-medium">
                  Price
                </th>
                <th className="text-right p-2 text-muted-foreground font-medium">
                  24h Vol
                </th>
                <th className="text-right p-2 text-muted-foreground font-medium">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {(analytics.trending || []).map((market) => (
                <tr
                  key={market.id}
                  className="border-b border-border hover:bg-secondary transition-colors"
                >
                  <td className="p-2">
                    <div className="flex flex-col">
                      <span className="text-foreground font-medium truncate">
                        {market.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {market.category}
                      </span>
                    </div>
                  </td>
                  <td className="text-right p-2 text-foreground">
                    ${parseFloat(String(market.price || 0)).toFixed(2)}
                  </td>
                  <td className="text-right p-2 text-chart-2 font-medium">
                    ${((parseFloat(String(market.volume_24h || 0))) / 1000).toFixed(1)}K
                  </td>
                  <td className="text-right p-2 text-muted-foreground text-xs">
                    {market.source === 'polymarket' ? 'PM' : 'KL'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
