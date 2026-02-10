// Alerts service for managing user preferences and creating notifications

export interface AlertPreference {
  id: string
  userId: string
  minSpreadPercentage: number
  minLiquidityUSD: number
  categories: string[]
  channels: ('email' | 'webhook' | 'browser')[]
  enabled: boolean
  webhookUrl?: string
  createdAt: string
  updatedAt: string
}

export interface AlertNotification {
  id: string
  userId: string
  opportunityId: string
  title: string
  spreadPercentage: number
  profitMargin: number
  buyExchange: string
  sellExchange: string
  status: 'sent' | 'failed' | 'pending'
  sentAt?: string
  deliveryChannels: ('email' | 'webhook' | 'browser')[]
}

// In-memory store for demo (replace with database in production)
const alertPreferences = new Map<string, AlertPreference>()
const alertNotifications: AlertNotification[] = []

export function createAlertPreference(
  userId: string,
  preference: Omit<AlertPreference, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): AlertPreference {
  const id = `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const newPref: AlertPreference = {
    id,
    userId,
    ...preference,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  alertPreferences.set(id, newPref)
  return newPref
}

export function getAlertPreference(userId: string): AlertPreference | null {
  // Get first preference for user (in production, would be more robust)
  for (const pref of alertPreferences.values()) {
    if (pref.userId === userId) {
      return pref
    }
  }
  return null
}

export function updateAlertPreference(
  preferenceId: string,
  updates: Partial<AlertPreference>
): AlertPreference | null {
  const pref = alertPreferences.get(preferenceId)
  if (!pref) return null

  const updated: AlertPreference = {
    ...pref,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  alertPreferences.set(preferenceId, updated)
  return updated
}

export function shouldTriggerAlert(
  opportunity: any,
  preference: AlertPreference
): boolean {
  if (!preference.enabled) return false

  // Check spread threshold
  if (opportunity.spreadPercentage < preference.minSpreadPercentage) {
    return false
  }

  // Check liquidity threshold
  if (opportunity.minLiquidity < preference.minLiquidityUSD) {
    return false
  }

  // Check category filter
  if (
    preference.categories.length > 0 &&
    !preference.categories.some((cat) =>
      opportunity.category.toLowerCase().includes(cat.toLowerCase())
    )
  ) {
    return false
  }

  return true
}

export function createAlertNotification(
  userId: string,
  opportunity: any,
  channels: ('email' | 'webhook' | 'browser')[] = ['browser']
): AlertNotification {
  const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const notification: AlertNotification = {
    id,
    userId,
    opportunityId: opportunity.id,
    title: opportunity.title,
    spreadPercentage: opportunity.spreadPercentage,
    profitMargin: opportunity.profitMargin,
    buyExchange: opportunity.buyExchange,
    sellExchange: opportunity.sellExchange,
    status: 'pending',
    deliveryChannels: channels,
  }

  alertNotifications.push(notification)
  return notification
}

export async function sendAlertNotification(
  notification: AlertNotification,
  preference: AlertPreference
): Promise<boolean> {
  try {
    const channelsToUse = notification.deliveryChannels || preference.channels

    // Send to each channel
    for (const channel of channelsToUse) {
      if (channel === 'email') {
        await sendEmailAlert(preference.userId, notification)
      } else if (channel === 'webhook' && preference.webhookUrl) {
        await sendWebhookAlert(preference.webhookUrl, notification)
      } else if (channel === 'browser') {
        // Browser notifications handled client-side
        sendBrowserAlert(notification)
      }
    }

    // Update notification status
    const idx = alertNotifications.findIndex((n) => n.id === notification.id)
    if (idx >= 0) {
      alertNotifications[idx].status = 'sent'
      alertNotifications[idx].sentAt = new Date().toISOString()
    }

    return true
  } catch (error) {
    console.error('[alerts] Failed to send notification:', error)

    const idx = alertNotifications.findIndex((n) => n.id === notification.id)
    if (idx >= 0) {
      alertNotifications[idx].status = 'failed'
    }

    return false
  }
}

async function sendEmailAlert(
  userId: string,
  notification: AlertNotification
): Promise<void> {
  // TODO: Integrate with email service (SendGrid, Resend, etc.)
  console.log(
    `[alerts] Would send email to ${userId} about ${notification.title}: ${notification.spreadPercentage}% spread`
  )
}

async function sendWebhookAlert(
  webhookUrl: string,
  notification: AlertNotification
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'arbitrage_opportunity',
        opportunity: notification,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`)
    }
  } catch (error) {
    console.error('[alerts] Webhook send failed:', error)
    throw error
  }
}

function sendBrowserAlert(notification: AlertNotification): void {
  // Browser notifications will be handled client-side with browser API
  console.log('[alerts] Browser alert:', notification)
}
