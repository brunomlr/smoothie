/**
 * Batch Balance History API Route
 * Fetches balance history for multiple assets in a single request.
 * This reduces HTTP overhead compared to making separate requests per asset.
 */

import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import { getAnalyticsUserIdFromRequest, captureServerEvent, hashWalletAddress } from '@/lib/analytics-server'
import { resolveWalletAddress, getTimezone } from '@/lib/api'
import { get, set, cacheKey, todayDate, CACHE_TTL, ensureFreshRatesInBackground } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const user = searchParams.get('user')
    const assetsParam = searchParams.get('assets') // Comma-separated asset addresses
    const daysParam = searchParams.get('days') || '30'
    const days = parseInt(daysParam, 10)
    const timezone = getTimezone(searchParams)
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
    // Uses the shared Redis-coordinated helper so all routes and instances
    // dedupe against the same lock (a per-instance in-memory timer ran one
    // refresh per warm instance and could wedge permanently on serverless).
    ensureFreshRatesInBackground(() => eventsRepository.refreshDailyRates())

    // Cache the computed history per user/assets/day so repeat and concurrent
    // requests for the same wallet skip the heavy per-asset DB queries.
    // The key rotates daily (todayDate) and includes timezone, since date
    // boundaries are timezone-dependent. Assets are sorted so the key is
    // independent of the order they were passed in.
    const sortedAssetsKey = [...assets].sort().join(',')
    const batchCacheKey = cacheKey('balance-history-batch', resolvedUser, sortedAssetsKey, days, timezone, todayDate())

    type BatchResult = {
      asset_address: string
      history: unknown[]
      firstEventDate: string | null
      error: string | null
    }

    let results = await get<BatchResult[]>(batchCacheKey)
    if (!results) {
      // Fetch all balance histories in parallel
      results = await Promise.all(
        assets.map(async (asset): Promise<BatchResult> => {
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
      )

      // Only cache fully successful batches: a transient per-asset DB error
      // must not be served as an empty history for 5 minutes (and then pinned
      // even longer by client-side localStorage placeholders).
      if (results.every(r => r.error === null)) {
        await set(batchCacheKey, results, { ttl: CACHE_TTL.MEDIUM })
      }
    }

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
