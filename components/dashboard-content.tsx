'use client'

import { useState } from 'react'
import { MarketBrowserWithLiveUpdates } from '@/components/market-browser-live'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'
import { ArbitrageScanner } from '@/components/arbitrage-scanner'
import { AlertsPanel } from '@/components/alerts-panel'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, Zap, BellIcon } from 'lucide-react'

export function DashboardContent() {
  const [activeTab, setActiveTab] = useState<'markets' | 'analytics' | 'arbitrage' | 'alerts'>('markets')

  return (
    <main className="w-full h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header with Tabs */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">Market Terminal</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'markets' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('markets')}
              className={
                activeTab === 'markets'
                  ? 'bg-primary text-primary-foreground'
                  : 'border-border hover:bg-secondary'
              }
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Markets
            </Button>
            <Button
              variant={activeTab === 'analytics' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('analytics')}
              className={
                activeTab === 'analytics'
                  ? 'bg-primary text-primary-foreground'
                  : 'border-border hover:bg-secondary'
              }
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Button
              variant={activeTab === 'arbitrage' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('arbitrage')}
              className={
                activeTab === 'arbitrage'
                  ? 'bg-chart-2 text-white hover:bg-chart-2/90'
                  : 'border-border hover:bg-secondary'
              }
            >
              <Zap className="w-4 h-4 mr-2" />
              Arbitrage
            </Button>
            <Button
              variant={activeTab === 'alerts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('alerts')}
              className={
                activeTab === 'alerts'
                  ? 'bg-chart-3 text-white hover:bg-chart-3/90'
                  : 'border-border hover:bg-secondary'
              }
            >
              <BellIcon className="w-4 h-4 mr-2" />
              Alerts
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {activeTab === 'markets' && <MarketBrowserWithLiveUpdates />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'arbitrage' && <ArbitrageScanner />}
          {activeTab === 'alerts' && <AlertsPanel />}
        </div>
      </div>
    </main>
  )
}
