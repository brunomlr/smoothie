/**
 * Client-side analytics hook
 * Currently uses PostHog as the backend
 */

import { useCallback } from 'react'
import posthog from 'posthog-js'

export const ANALYTICS_USER_ID_HEADER = 'X-Analytics-User-Id'

// Salt for hashing wallet addresses - provides additional privacy
const WALLET_HASH_SALT = 'smoothie-analytics-v1'

/**
 * Hash a wallet address for privacy-preserving analytics.
 * Uses SHA256 with a salt to prevent direct correlation with on-chain data.
 */
export async function hashWalletAddress(address: string): Promise<string> {
  if (!address) return ''
  const normalized = address.toLowerCase().trim()
  const str = `${WALLET_HASH_SALT}:${normalized}`

  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex.slice(0, 16) // First 16 chars is enough for uniqueness
}

export function getAnalyticsUserId(): string | null {
  if (typeof window !== 'undefined') {
    return posthog.get_distinct_id() || null
  }
  return null
}

export function useAnalytics() {
  const capture = useCallback((event: string, properties?: Record<string, unknown>) => {
    if (typeof window !== 'undefined') {
      posthog.capture(event, properties)
    }
  }, [])

  const identify = useCallback((userId?: string, properties?: Record<string, unknown>) => {
    if (typeof window !== 'undefined') {
      posthog.identify(userId, properties)
    }
  }, [])

  const getUserId = useCallback((): string | null => {
    return getAnalyticsUserId()
  }, [])

  return { capture, identify, getUserId }
}
