/**
 * Server-side analytics utility for capturing events from API routes
 * Currently uses PostHog as the backend
 */

import { PostHog } from 'posthog-node'
import { NextRequest } from 'next/server'

export const ANALYTICS_USER_ID_HEADER = 'x-analytics-user-id'

let analyticsClient: PostHog | null = null

function getAnalyticsClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null
  }

  if (!analyticsClient) {
    analyticsClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1, // Flush after each event for serverless environments
      flushInterval: 0,
    })
  }

  return analyticsClient
}

export function getAnalyticsUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get(ANALYTICS_USER_ID_HEADER)
}

export interface CaptureOptions {
  event: string
  properties?: Record<string, unknown>
  $set?: Record<string, unknown>
  $set_once?: Record<string, unknown>
}

export function captureServerEvent(
  userId: string | null,
  options: CaptureOptions
): void {
  if (!userId) {
    return
  }

  const client = getAnalyticsClient()
  if (!client) {
    return
  }

  const { event, properties, $set, $set_once } = options

  // Capture the event with event properties only
  // Wallet addresses are tracked via the wallet_address event property
  client.capture({
    distinctId: userId,
    event,
    properties,
  })

  // Use identify for person property operations
  if ($set || $set_once) {
    const personProperties: Record<string, unknown> = {}

    if ($set) {
      Object.assign(personProperties, $set)
    }

    if ($set_once) {
      personProperties.$set_once = $set_once
    }

    client.identify({
      distinctId: userId,
      properties: personProperties,
    })
  }
}

export async function shutdownAnalytics(): Promise<void> {
  if (analyticsClient) {
    await analyticsClient.shutdown()
    analyticsClient = null
  }
}
