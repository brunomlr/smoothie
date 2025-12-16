/**
 * Client-side analytics hook
 * Currently uses PostHog as the backend
 */

import { useCallback } from 'react'
import posthog from 'posthog-js'

export const ANALYTICS_USER_ID_HEADER = 'X-Analytics-User-Id'

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
