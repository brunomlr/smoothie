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
} from '@/lib/api'

// Track when daily_rates was last refreshed (in-memory cache)
let lastRatesRefresh: number = 0
const RATES_REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

async function ensureFreshRates(): Promise<void> {
  const now = Date.now()
  if (now - lastRatesRefresh > RATES_REFRESH_INTERVAL_MS) {
    try {
      await eventsRepository.refreshDailyRates()
      lastRatesRefresh = now
    } catch {
      // Don't throw - continue with stale data rather than failing
    }
  }
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

  analytics: {
    event: 'balance_history_fetched',
    getUserAddress: (request) => request.nextUrl.searchParams.get('user') || undefined,
    getProperties: (result) => ({
      days: result.days,
      data_points: result.count,
    }),
  },

  async handler(_request: NextRequest, { searchParams }) {
    const user = requireString(searchParams, 'user')
    const asset = requireString(searchParams, 'asset')
    const days = optionalInt(searchParams, 'days', 30, { min: 1 })
    const timezone = getTimezone(searchParams)

    // Ensure daily_rates is fresh (refresh if stale)
    await ensureFreshRates()

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
