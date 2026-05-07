'use client'

import { useState } from 'react'
import { MarketBrowserWithLiveUpdates } from '@/components/market-browser-live'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'
import { ArbitrageScanner } from '@/components/arbitrage-scanner'
import { AlertsPanel } from '@/components/alerts-panel'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  TrendingUp,
  Zap,
  BellIcon,
  Search,
  Activity,
  Sparkles,
} from 'lucide-react'

type Tab = 'markets' | 'analytics' | 'arbitrage' | 'alerts'

// Polymarket-style top-of-page category nav. The first two are "modes",
// the rest are content tags that pre-filter the markets view.
const TOP_NAV: Array<{ key: string; label: string; icon?: React.ReactNode }> = [
  { key: 'trending', label: 'Trending', icon: <Activity className="w-3.5 h-3.5" /> },
  { key: 'new', label: 'New', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { key: 'politics', label: 'Politics' },
  { key: 'sports', label: 'Sports' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'tech', label: 'Tech' },
  { key: 'culture', label: 'Culture' },
  { key: 'world', label: 'World' },
  { key: 'economy', label: 'Economy' },
  { key: 'trump', label: 'Trump' },
  { key: 'elections', label: 'Elections' },
  { key: 'mentions', label: 'Mentions' },
]

export function DashboardContent() {
  const [activeTab, setActiveTab] = useState<Tab>('markets')
  const [navFilter, setNavFilter] = useState<string>('trending')
  const [search, setSearch] = useState('')

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'markets', label: 'Markets', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'arbitrage', label: 'Arbitrage', icon: <Zap className="w-4 h-4" /> },
    { key: 'alerts', label: 'Alerts', icon: <BellIcon className="w-4 h-4" /> },
  ]

  return (
    <main className="w-full min-h-screen text-foreground flex flex-col">
      {/* Brand + search row */}
      <div className="px-6 pt-5 pb-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-primary/15 border border-primary/40 glow-primary">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Market Terminal
            </h1>
            <p className="text-[11px] text-muted-foreground -mt-0.5">
              Polymarket × Kalshi
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets…"
            className="glass w-full pl-9 pr-3 h-10 rounded-full text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary pulse-dot" />
            Live
          </span>
        </div>
      </div>

      {/* Polymarket-style category nav */}
      <div className="px-6 border-b border-border/60">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2">
          {TOP_NAV.map((nav) => {
            const active = navFilter === nav.key
            return (
              <button
                key={nav.key}
                onClick={() => {
                  setNavFilter(nav.key)
                  setActiveTab('markets')
                }}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-primary/15 text-primary border border-primary/40'
                    : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
                }`}
              >
                {nav.icon}
                {nav.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {tabs.map((t) => {
            const active = activeTab === t.key
            return (
              <Button
                key={t.key}
                size="sm"
                variant="outline"
                onClick={() => setActiveTab(t.key)}
                className={`${
                  active
                    ? 'bg-primary text-primary-foreground border-primary glow-primary hover:bg-primary/90'
                    : 'glass border-border text-foreground hover:text-primary'
                }`}
              >
                <span className="mr-2">{t.icon}</span>
                {t.label}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-10">
        {activeTab === 'markets' && (
          <MarketBrowserWithLiveUpdates
            externalCategory={navFilter}
            externalSearch={search}
          />
        )}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'arbitrage' && <ArbitrageScanner />}
        {activeTab === 'alerts' && <AlertsPanel />}
      </div>
    </main>
  )
}
