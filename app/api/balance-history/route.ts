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
import { cacheKey, todayDate, CACHE_TTL, ensureFreshRatesInBackground } from '@/lib/redis'

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
        resolveWalletAddress(params.get('user') || ''),
        params.get('asset') || '',
        params.get('days') || '30',
        // Day boundaries and the grid end depend on the user's timezone -
        // omitting it served one timezone's "today" to users in another
        params.get('timezone') || 'UTC',
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
    ensureFreshRatesInBackground(() => eventsRepository.refreshDailyRates())

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
