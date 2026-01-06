/**
 * APY History API Route
 * Fetches daily b_rates and calculates historical APY from rate changes
 */

import { NextRequest } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  createApiHandler,
  requireString,
  optionalInt,
  CACHE_CONFIGS,
} from '@/lib/api'
import { cacheKey, CACHE_TTL } from '@/lib/redis'

export interface ApyDataPoint {
  date: string
  apy: number
}

interface ApyHistoryResponse {
  pool_id: string
  asset_address: string
  days: number
  count: number
  history: ApyDataPoint[]
}

/**
 * Calculate APY from consecutive b_rate values
 * APY = ((b_rate_today / b_rate_yesterday) ^ 365 - 1) * 100
 */
function calculateApyFromRates(
  rates: { rate_date: string; b_rate: number | null }[]
): ApyDataPoint[] {
  // Sort by date ascending
  const sorted = [...rates].sort(
    (a, b) => new Date(a.rate_date).getTime() - new Date(b.rate_date).getTime()
  )

  const result: ApyDataPoint[] = []
  let lastApy = 0

  for (let i = 1; i < sorted.length; i++) {
    const prevRate = sorted[i - 1].b_rate
    const currRate = sorted[i].b_rate

    if (prevRate && currRate && prevRate > 0) {
      const dailyReturn = currRate / prevRate
      // Annualize: (1 + daily_return) ^ 365 - 1
      const apy = (Math.pow(dailyReturn, 365) - 1) * 100
      lastApy = apy
      result.push({
        date: sorted[i].rate_date,
        apy: Math.max(0, apy), // APY shouldn't be negative for supply
      })
    } else {
      // Carry forward previous APY if data is missing
      result.push({
        date: sorted[i].rate_date,
        apy: lastApy,
      })
    }
  }

  return result
}

export const GET = createApiHandler<ApyHistoryResponse>({
  logPrefix: '[APY History API]',
  cache: CACHE_CONFIGS.LONG,

  redisCache: {
    ttl: CACHE_TTL.LONG, // 15 minutes - historical APY doesn't change frequently
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      return cacheKey(
        'apy-history',
        params.get('pool') || '',
        params.get('asset') || '',
        params.get('days') || '180'
      )
    },
  },

  async handler(_request: NextRequest, { searchParams }) {
    const poolId = requireString(searchParams, 'pool')
    const asset = requireString(searchParams, 'asset')
    const days = optionalInt(searchParams, 'days', 180, { min: 1 })

    // Fetch daily rates - add 1 extra day to calculate first day's APY
    const rates = await eventsRepository.getDailyRates(asset, poolId, days + 1)

    // Calculate APY from b_rate changes
    const apyHistory = calculateApyFromRates(rates)

    return {
      pool_id: poolId,
      asset_address: asset,
      days,
      count: apyHistory.length,
      history: apyHistory,
    }
  },
})
