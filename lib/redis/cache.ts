import { redis, isRedisEnabled, logRedisStatus } from './client'

export interface CacheOptions {
  /** TTL in seconds */
  ttl: number
  /** Optional prefix for cache keys */
  prefix?: string
}

/** Standard TTL configurations (in seconds) */
export const CACHE_TTL = {
  /** 1 minute - for rapidly changing data like prices */
  SHORT: 60,
  /** 5 minutes - for user-specific computed data */
  MEDIUM: 300,
  /** 15 minutes - for rates and semi-stable data */
  LONG: 900,
  /** 1 hour - for metadata and pool info */
  VERY_LONG: 3600,
} as const

/**
 * Generate a cache key from components
 * @example cacheKey('balance-history', userAddress, assetAddress, '30')
 */
export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(':')
}

/**
 * Get cached value or compute and cache it
 *
 * Falls back to computing the value if Redis is disabled or fails.
 */
export async function getOrSet<T>(
  key: string,
  compute: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  // Log Redis status on first use
  logRedisStatus()

  // If Redis is not enabled, just compute
  if (!isRedisEnabled || !redis) {
    return compute()
  }

  const { ttl, prefix } = options
  const fullKey = prefix ? `${prefix}:${key}` : key

  try {
    // Try to get from cache
    const cached = await redis.get<T>(fullKey)
    if (cached !== null) {
      return cached
    }

    // Compute value
    const value = await compute()

    // Cache the result (fire and forget to not block response)
    redis.set(fullKey, value, { ex: ttl }).catch((err) => {
      console.error('[Redis] Failed to cache value:', err)
    })

    return value
  } catch (error) {
    // If Redis fails, fall back to computing the value
    console.error('[Redis] Cache error, falling back to compute:', error)
    return compute()
  }
}

/**
 * Get a value from cache
 * Returns null if not found or Redis is disabled
 */
export async function get<T>(key: string, prefix?: string): Promise<T | null> {
  if (!isRedisEnabled || !redis) {
    return null
  }

  const fullKey = prefix ? `${prefix}:${key}` : key

  try {
    return await redis.get<T>(fullKey)
  } catch (error) {
    console.error('[Redis] Failed to get value:', error)
    return null
  }
}

/**
 * Set a value in cache
 */
export async function set<T>(
  key: string,
  value: T,
  options: CacheOptions
): Promise<void> {
  if (!isRedisEnabled || !redis) {
    return
  }

  const { ttl, prefix } = options
  const fullKey = prefix ? `${prefix}:${key}` : key

  try {
    await redis.set(fullKey, value, { ex: ttl })
  } catch (error) {
    console.error('[Redis] Failed to set value:', error)
  }
}

/**
 * Invalidate cache entries by pattern
 * Use with caution - KEYS command can be slow on large datasets
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  if (!isRedisEnabled || !redis) {
    return 0
  }

  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return keys.length
  } catch (error) {
    console.error('[Redis] Failed to invalidate pattern:', pattern, error)
    return 0
  }
}

/**
 * Invalidate specific cache key
 */
export async function invalidate(key: string, prefix?: string): Promise<void> {
  if (!isRedisEnabled || !redis) {
    return
  }

  const fullKey = prefix ? `${prefix}:${key}` : key

  try {
    await redis.del(fullKey)
  } catch (error) {
    console.error('[Redis] Failed to invalidate key:', key, error)
  }
}
