/**
 * Batch Balance History API Route
 * Fetches balance history for multiple assets in a single request.
 * This reduces HTTP overhead compared to making separate requests per asset.
 */

import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import { getAnalyticsUserIdFromRequest, captureServerEvent, hashWalletAddress } from '@/lib/analytics-server'
import { resolveWalletAddress } from '@/lib/api'
import { getOrSet, cacheKey, todayDate, CACHE_TTL } from '@/lib/redis'

// Track when daily_rates was last refreshed (in-memory cache)
let lastRatesRefresh: number = 0
let refreshInFlight = false
const RATES_REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Triggers a daily_rates refresh in the background when the cache is stale.
 *
 * This is intentionally NOT awaited by the request handler. The view is
 * materialized, so it always has data to serve; the worst case is that one
 * request returns rates that are up to ~15 minutes stale while the refresh
 * runs. `REFRESH MATERIALIZED VIEW CONCURRENTLY` can take several seconds,
 * so blocking the request on it made one unlucky user every 15 minutes wait
 * for the entire refresh before any chart data was returned.
 */
function ensureFreshRates(): void {
  const now = Date.now()
  // Skip if a refresh is already running or the cache is still fresh.
  if (refreshInFlight || now - lastRatesRefresh <= RATES_REFRESH_INTERVAL_MS) {
    return
  }
  refreshInFlight = true
  // Optimistically advance the timer so concurrent requests don't also trigger
  // a refresh while this one is in flight.
  lastRatesRefresh = now
  eventsRepository
    .refreshDailyRates()
    .catch(() => {
      // Refresh failed - roll back the timer so the next request retries
      // rather than waiting out the full interval on stale data.
      lastRatesRefresh = 0
    })
    .finally(() => {
      refreshInFlight = false
    })
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const user = searchParams.get('user')
    const assetsParam = searchParams.get('assets') // Comma-separated asset addresses
    const daysParam = searchParams.get('days') || '30'
    const days = parseInt(daysParam, 10)
    const timezone = searchParams.get('timezone') || 'UTC'
    const analyticsUserId = getAnalyticsUserIdFromRequest(request)

    // Validate required parameters
    if (!user || !assetsParam) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'user and assets parameters are required',
        },
        { status: 400 },
      )
    }

    // Resolve demo wallet alias to real address
    const resolvedUser = resolveWalletAddress(user)

    const assets = assetsParam.split(',').filter(a => a.trim())

    if (assets.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid assets parameter',
          message: 'assets must contain at least one asset address',
        },
        { status: 400 },
      )
    }

    // Limit to prevent abuse
    if (assets.length > 50) {
      return NextResponse.json(
        {
          error: 'Too many assets',
          message: 'Maximum 50 assets per request',
        },
        { status: 400 },
      )
    }

    // Validate days parameter
    if (isNaN(days) || days < 1) {
      return NextResponse.json(
        {
          error: 'Invalid days parameter',
          message: 'days must be a positive number',
        },
        { status: 400 },
      )
    }

    // Kick off a daily_rates refresh in the background if stale (non-blocking).
    ensureFreshRates()

    // Cache the computed history per user/assets/day so repeat and concurrent
    // requests for the same wallet skip the heavy per-asset DB queries.
    // The key rotates daily (todayDate) and includes timezone, since date
    // boundaries are timezone-dependent. Assets are sorted so the key is
    // independent of the order they were passed in. getOrSet degrades to a
    // plain compute when Redis is disabled and never caches a thrown error.
    const sortedAssetsKey = [...assets].sort().join(',')
    const results = await getOrSet(
      cacheKey('balance-history-batch', resolvedUser, sortedAssetsKey, days, timezone, todayDate()),
      () =>
        // Fetch all balance histories in parallel
        Promise.all(
          assets.map(async (asset) => {
            try {
              const { history, firstEventDate } = await eventsRepository.getBalanceHistoryFromEvents(
                resolvedUser,
                asset,
                days,
                timezone,
              )
              return {
                asset_address: asset,
                history,
                firstEventDate,
                error: null,
              }
            } catch (error) {
              return {
                asset_address: asset,
                history: [],
                firstEventDate: null,
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            }
          })
        ),
      { ttl: CACHE_TTL.MEDIUM },
    )

    const hashedAddress = hashWalletAddress(user)
    captureServerEvent(analyticsUserId, {
      event: 'balance_history_batch_fetched',
      properties: {
        wallet_address_hash: hashedAddress,
        days,
        asset_count: assets.length,
      },
      $set: { last_wallet_address_hash: hashedAddress },
    })

    return NextResponse.json({
      user_address: user,
      days,
      results,
      source: 'database',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache
      },
    })
  } catch (error) {
    console.error('[Balance History Batch API] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
