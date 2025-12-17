/**
 * Server-side analytics utility for capturing events from API routes
 * Currently uses PostHog as the backend
 */

import { PostHog } from 'posthog-node'
import { NextRequest } from 'next/server'
import { createHash } from 'crypto'

// Salt for hashing wallet addresses - provides additional privacy
const WALLET_HASH_SALT = process.env.ANALYTICS_WALLET_SALT || 'smoothie-analytics-v1'

/**
 * Hash a wallet address for privacy-preserving analytics.
 * Uses SHA256 with a salt to prevent direct correlation with on-chain data.
 */
export function hashWalletAddress(address: string): string {
  if (!address) return ''
  const normalized = address.toLowerCase().trim()
  return createHash('sha256')
    .update(`${WALLET_HASH_SALT}:${normalized}`)
    .digest('hex')
    .slice(0, 16) // First 16 chars is enough for uniqueness while being shorter
}

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
  // Wallet addresses are hashed for privacy before being tracked
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
