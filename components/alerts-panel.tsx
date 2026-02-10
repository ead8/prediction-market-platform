'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BellIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react'

interface AlertPreference {
  minSpreadPercentage: number
  minLiquidityUSD: number
  categories: string[]
  channels: ('email' | 'webhook' | 'browser')[]
  enabled: boolean
  webhookUrl?: string
}

export function AlertsPanel() {
  const [preferences, setPreferences] = useState<AlertPreference>({
    minSpreadPercentage: 2,
    minLiquidityUSD: 10000,
    categories: [],
    channels: ['browser'],
    enabled: true,
  })

  const [showWebhook, setShowWebhook] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const userId = 'demo-user' // In production, get from auth context

  // Fetch current preferences
  const { data: prefData } = useSWR(
    `/api/alerts?userId=${userId}`,
    (url) => fetch(url).then((res) => res.json()),
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (prefData?.preference) {
      setPreferences(prefData.preference)
    }
  }, [prefData])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          preferences,
        }),
      })

      if (response.ok) {
        console.log('Alert preferences saved')
      }
    } catch (error) {
      console.error('Failed to save preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleChannel = (channel: 'email' | 'webhook' | 'browser') => {
    const updatedChannels = preferences.channels.includes(channel)
      ? preferences.channels.filter((c) => c !== channel)
      : [...preferences.channels, channel]

    setPreferences({ ...preferences, channels: updatedChannels })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BellIcon className="w-6 h-6 text-chart-2" />
        <h2 className="text-2xl font-bold">Smart Alerts</h2>
      </div>

      {/* Alert Status */}
      <Card className={preferences.enabled ? 'border-chart-2' : 'border-chart-4'}>
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {preferences.enabled ? (
              <>
                <CheckCircleIcon className="w-5 h-5 text-chart-2" />
                <div>
                  <div className="font-bold text-foreground">Alerts Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    Receiving notifications on {preferences.channels.join(', ')}
                  </div>
                </div>
              </>
            ) : (
              <>
                <AlertCircleIcon className="w-5 h-5 text-chart-4" />
                <div>
                  <div className="font-bold text-foreground">Alerts Disabled</div>
                  <div className="text-sm text-muted-foreground">
                    Enable alerts to receive opportunity notifications
                  </div>
                </div>
              </>
            )}
          </div>
          <Button
            onClick={() => setPreferences({ ...preferences, enabled: !preferences.enabled })}
            className={preferences.enabled ? 'bg-chart-4' : 'bg-chart-2'}
          >
            {preferences.enabled ? 'Disable' : 'Enable'}
          </Button>
        </CardContent>
      </Card>

      {/* Alert Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Preferences</CardTitle>
          <CardDescription>Configure when you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Minimum Spread */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Minimum Spread %</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.5"
                max="20"
                step="0.5"
                value={preferences.minSpreadPercentage}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    minSpreadPercentage: parseFloat(e.target.value),
                  })
                }
                className="flex-1 h-2 bg-secondary rounded-lg"
              />
              <span className="text-sm font-bold text-chart-2 w-16">
                {preferences.minSpreadPercentage}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Only alert on opportunities with spreads above this threshold
            </p>
          </div>

          {/* Minimum Liquidity */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Minimum Liquidity</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="1000"
                step="1000"
                value={preferences.minLiquidityUSD}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    minLiquidityUSD: parseInt(e.target.value),
                  })
                }
                className="flex-1 px-3 py-2 bg-secondary border border-border rounded"
              />
              <span className="text-sm text-muted-foreground w-16">USD</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum liquidity required on both exchanges
            </p>
          </div>

          {/* Notification Channels */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Notification Channels</label>
            <div className="space-y-2">
              <button
                onClick={() => toggleChannel('browser')}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                  preferences.channels.includes('browser')
                    ? 'border-chart-1 bg-chart-1/10'
                    : 'border-border bg-secondary'
                }`}
              >
                <div className="font-medium">Browser Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Real-time alerts in your browser
                </div>
              </button>

              <button
                onClick={() => toggleChannel('email')}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                  preferences.channels.includes('email')
                    ? 'border-chart-3 bg-chart-3/10'
                    : 'border-border bg-secondary'
                }`}
              >
                <div className="font-medium">Email Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Receive alerts via email (coming soon)
                </div>
              </button>

              <button
                onClick={() => {
                  toggleChannel('webhook')
                  setShowWebhook(!showWebhook)
                }}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                  preferences.channels.includes('webhook')
                    ? 'border-chart-5 bg-chart-5/10'
                    : 'border-border bg-secondary'
                }`}
              >
                <div className="font-medium">Webhook Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Send alerts to a custom webhook URL
                </div>
              </button>

              {showWebhook && preferences.channels.includes('webhook') && (
                <input
                  type="url"
                  placeholder="https://your-webhook.com/alerts"
                  value={preferences.webhookUrl || ''}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      webhookUrl: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm"
                />
              )}
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-chart-2 hover:bg-chart-2/90 text-white font-bold"
          >
            {isSaving ? 'Saving...' : 'Save Alert Preferences'}
          </Button>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Smart Alerts Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="bg-chart-2 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">
              1
            </div>
            <div>
              <div className="font-medium">Continuous Monitoring</div>
              <div className="text-muted-foreground">
                We continuously scan Polymarket and Kalshi for price discrepancies
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-chart-2 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">
              2
            </div>
            <div>
              <div className="font-medium">Threshold Matching</div>
              <div className="text-muted-foreground">
                Opportunities are filtered by your configured minimum spread and liquidity
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-chart-2 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">
              3
            </div>
            <div>
              <div className="font-medium">Instant Notifications</div>
              <div className="text-muted-foreground">
                Get alerts via browser, email, or webhook within seconds of detection
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
