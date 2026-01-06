import { Redis } from '@upstash/redis'

// Only create Redis client if both env vars are set
const hasRedisConfig =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

export const redis = hasRedisConfig
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

export const isRedisEnabled = redis !== null

// Log once on first use, not on every import
let hasLoggedStatus = false
export function logRedisStatus(): void {
  if (hasLoggedStatus) return
  hasLoggedStatus = true

  if (!isRedisEnabled) {
    console.info('[Redis] Caching disabled - UPSTASH env vars not set')
  }
}
