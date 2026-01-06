import { redis, isRedisEnabled } from './client'

const RATES_REFRESH_KEY = 'rates:last-refresh'
const RATES_LOCK_KEY = 'rates:refresh-lock'
const RATES_REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
const LOCK_TTL_SECONDS = 60 // Lock expires after 60 seconds (in case refresh fails)

/**
 * Try to acquire a lock for refreshing rates.
 * Uses Redis SETNX to prevent multiple instances from refreshing simultaneously.
 *
 * Returns true if:
 * - Redis is disabled (fall back to local refresh)
 * - Lock was acquired and rates are stale
 *
 * Returns false if:
 * - Rates are fresh (no refresh needed)
 * - Another instance is already refreshing (lock held)
 */
export async function shouldRefreshRates(): Promise<boolean> {
  if (!isRedisEnabled || !redis) {
    // Fall back to always refreshing if Redis is not available
    return true
  }

  try {
    // First check if rates are stale
    const lastRefresh = await redis.get<number>(RATES_REFRESH_KEY)
    if (lastRefresh !== null && Date.now() - lastRefresh <= RATES_REFRESH_INTERVAL_MS) {
      // Rates are fresh, no refresh needed
      return false
    }

    // Rates are stale or never refreshed. Try to acquire lock.
    // SETNX returns true if key was set (we got the lock), false if already exists
    const gotLock = await redis.set(RATES_LOCK_KEY, Date.now(), {
      nx: true, // Only set if not exists
      ex: LOCK_TTL_SECONDS, // Auto-expire lock
    })

    if (!gotLock) {
      // Another instance is already refreshing
      return false
    }

    // We got the lock, proceed with refresh
    return true
  } catch (error) {
    console.error('[Redis] Failed to check rates refresh:', error)
    return true // Refresh on error to be safe
  }
}

/**
 * Mark rates as refreshed and release the lock
 * Call this after successfully refreshing rates
 */
export async function markRatesRefreshed(): Promise<void> {
  if (!isRedisEnabled || !redis) {
    return
  }

  try {
    // Update the refresh timestamp and remove the lock
    await Promise.all([
      redis.set(RATES_REFRESH_KEY, Date.now(), { ex: 3600 }), // 1 hour expiry
      redis.del(RATES_LOCK_KEY),
    ])
  } catch (error) {
    console.error('[Redis] Failed to mark rates refreshed:', error)
  }
}

/**
 * Release the lock without marking as refreshed
 * Call this if refresh fails
 */
export async function releaseRatesLock(): Promise<void> {
  if (!isRedisEnabled || !redis) {
    return
  }

  try {
    await redis.del(RATES_LOCK_KEY)
  } catch (error) {
    console.error('[Redis] Failed to release rates lock:', error)
  }
}
