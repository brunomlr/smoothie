/**
 * Batch Balance History API Route
 * Fetches balance history for multiple assets in a single request.
 * This reduces HTTP overhead compared to making separate requests per asset.
 *
 * `assets` is optional: when omitted the asset list is derived from the user's
 * events, so the caller does not have to resolve the wallet's positions first.
 * Rows ship columnar (see lib/balance-history-codec.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import { getAnalyticsUserIdFromRequest, captureServerEvent, hashWalletAddress } from '@/lib/analytics-server'
import { resolveWalletAddress, getTimezone } from '@/lib/api'
import { get, set, cacheKey, todayDate, CACHE_TTL, ensureFreshRatesInBackground } from '@/lib/redis'
import {
  encodeBalanceHistory,
  EMPTY_BALANCE_HISTORY_COLUMNS,
  type BalanceHistoryColumns,
} from '@/lib/balance-history-codec'

export interface BalanceHistoryBatchResult {
  asset_address: string
  columns: BalanceHistoryColumns
  firstEventDate: string | null
  error: string | null
}

export interface BalanceHistoryBatchResponse {
  user_address: string
  days: number
  results: BalanceHistoryBatchResult[]
  source: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const user = searchParams.get('user')
    const assetsParam = searchParams.get('assets') // Comma-separated asset addresses (optional)
    const daysParam = searchParams.get('days') || '30'
    const days = parseInt(daysParam, 10)
    const timezone = getTimezone(searchParams)
    const analyticsUserId = getAnalyticsUserIdFromRequest(request)

    // Validate required parameters
    if (!user) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'user parameter is required',
        },
        { status: 400 },
      )
    }

    // Resolve demo wallet alias to real address
    const resolvedUser = resolveWalletAddress(user)

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

    // Without an explicit list, derive the assets from the user's own events.
    // This is what lets the client fire this request before the wallet snapshot
    // has resolved which positions are open.
    const assets = assetsParam
      ? assetsParam.split(',').filter(a => a.trim())
      : await eventsRepository.getUserAssetAddresses(resolvedUser)

    if (assetsParam && assets.length === 0) {
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

    // Kick off a daily_rates refresh in the background if stale (non-blocking).
    // Uses the shared Redis-coordinated helper so all routes and instances
    // dedupe against the same lock (a per-instance in-memory timer ran one
    // refresh per warm instance and could wedge permanently on serverless).
    ensureFreshRatesInBackground(() => eventsRepository.refreshDailyRates())

    if (assets.length === 0) {
      return NextResponse.json({
        user_address: user,
        days,
        results: [],
        source: 'database',
      } satisfies BalanceHistoryBatchResponse)
    }

    // Cache the computed history per user/assets/day so repeat and concurrent
    // requests for the same wallet skip the heavy per-asset DB queries.
    // The key rotates daily (todayDate) and includes timezone, since date
    // boundaries are timezone-dependent. Assets are sorted so the key is
    // independent of the order they were passed in (and so a derived list and
    // an explicit one covering the same assets share an entry).
    const sortedAssetsKey = [...assets].sort().join(',')
    const batchCacheKey = cacheKey('balance-history-batch', resolvedUser, sortedAssetsKey, days, timezone, todayDate())

    let results = await get<BalanceHistoryBatchResult[]>(batchCacheKey)
    if (!results) {
      // Fetch all balance histories in parallel
      results = await Promise.all(
        assets.map(async (asset): Promise<BalanceHistoryBatchResult> => {
          try {
            const { history, firstEventDate } = await eventsRepository.getBalanceHistoryFromEvents(
              resolvedUser,
              asset,
              days,
              timezone,
            )
            return {
              asset_address: asset,
              columns: encodeBalanceHistory(history),
              firstEventDate,
              error: null,
            }
          } catch (error) {
            return {
              asset_address: asset,
              columns: EMPTY_BALANCE_HISTORY_COLUMNS,
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
    } satisfies BalanceHistoryBatchResponse, {
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
