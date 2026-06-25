/**
 * Balance History API Route
 * Fetches balance history from database (parsed_events + daily_rates)
 */

import { NextRequest } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  createApiHandler,
  requireString,
  optionalInt,
  getTimezone,
  CACHE_CONFIGS,
  resolveWalletAddress,
} from '@/lib/api'
import { cacheKey, todayDate, CACHE_TTL, shouldRefreshRates, markRatesRefreshed, releaseRatesLock } from '@/lib/redis'

function ensureFreshRates(): void {
  // Refresh daily_rates in the background when stale. This is intentionally
  // NOT awaited: the view is materialized so it always has data to serve, and
  // `REFRESH MATERIALIZED VIEW CONCURRENTLY` can take several seconds - awaiting
  // it made one request every refresh interval wait out the entire refresh
  // before returning any data. Redis coordination dedupes refreshes across
  // instances. See balance-history-batch/route.ts for the same rationale.
  void (async () => {
    if (await shouldRefreshRates()) {
      try {
        await eventsRepository.refreshDailyRates()
        await markRatesRefreshed()
      } catch {
        // Release the lock so other instances can try
        await releaseRatesLock()
        // Don't throw - continue with stale data rather than failing
      }
    }
  })()
}

interface BalanceHistoryResponse {
  user_address: string
  asset_address: string
  days: number
  count: number
  history: unknown[]
  firstEventDate: string | null
  source: string
}

export const GET = createApiHandler<BalanceHistoryResponse>({
  logPrefix: '[Balance History API]',
  cache: CACHE_CONFIGS.MEDIUM,

  redisCache: {
    ttl: CACHE_TTL.MEDIUM,
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      return cacheKey(
        'balance-history',
        params.get('user') || '',
        params.get('asset') || '',
        params.get('days') || '30',
        todayDate() // Include date so cache rotates daily
      )
    },
  },

  analytics: {
    event: 'balance_history_fetched',
    getUserAddress: (request) => request.nextUrl.searchParams.get('user') || undefined,
    getProperties: (result) => ({
      days: result.days,
      data_points: result.count,
    }),
  },

  async handler(_request: NextRequest, { searchParams }) {
    const user = resolveWalletAddress(requireString(searchParams, 'user'))
    const asset = requireString(searchParams, 'asset')
    const days = optionalInt(searchParams, 'days', 30, { min: 1 })
    const timezone = getTimezone(searchParams)

    // Kick off a daily_rates refresh in the background if stale (non-blocking).
    ensureFreshRates()

    const { history, firstEventDate } = await eventsRepository.getBalanceHistoryFromEvents(
      user,
      asset,
      days,
      timezone,
    )

    return {
      user_address: user,
      asset_address: asset,
      days,
      count: history.length,
      history,
      firstEventDate,
      source: 'database',
    }
  },
})
