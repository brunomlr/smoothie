/**
 * Backstop Q4W History API Route
 * Fetches historical Q4W (queue for withdrawal) percentages from backstop_pool_snapshots
 */

import { NextRequest } from 'next/server'
import { backstopPoolSnapshotsRepository } from '@/lib/db/repositories/backstop-pool-snapshots-repository'
import {
  createApiHandler,
  requireString,
  optionalInt,
  getTimezone,
  CACHE_CONFIGS,
} from '@/lib/api'
import { cacheKey, todayDate, CACHE_TTL } from '@/lib/redis'

export interface Q4wDataPoint {
  date: string
  q4wPercent: number
}

interface BackstopQ4wHistoryResponse {
  pool_id: string
  days: number
  count: number
  history: Q4wDataPoint[]
}

export const GET = createApiHandler<BackstopQ4wHistoryResponse>({
  logPrefix: '[Backstop Q4W History API]',
  cache: CACHE_CONFIGS.LONG,

  redisCache: {
    ttl: CACHE_TTL.VERY_LONG, // 1 hour - historical data only changes once per day
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      const timezone = params.get('timezone') || 'UTC'
      return cacheKey(
        'backstop-q4w-history',
        params.get('pool') || '',
        params.get('days') || '180',
        timezone,
        todayDate()
      )
    },
  },

  async handler(_request: NextRequest, { searchParams }) {
    const poolId = requireString(searchParams, 'pool')
    const days = optionalInt(searchParams, 'days', 180, { min: 1 })
    const timezone = getTimezone(searchParams)

    // Fetch Q4W history from snapshots
    const history = await backstopPoolSnapshotsRepository.getQ4wHistory(
      poolId,
      days,
      timezone
    )

    return {
      pool_id: poolId,
      days,
      count: history.length,
      history,
    }
  },
})
