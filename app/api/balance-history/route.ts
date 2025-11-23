/**
 * Balance History API Route
 * Fetches balance history from Dune Analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchDuneQueryResults } from '@/lib/dune/client'
import { transformDuneResults, filterByDays, DuneRow } from '@/lib/dune/transformer'
// import { userRepository } from '@/lib/db/user-repository' // Kept for reference, not used

const DUNE_QUERY_ID = 6245238

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const user = searchParams.get('user')
    const asset = searchParams.get('asset')
    const daysParam = searchParams.get('days') || '30'
    const days = parseInt(daysParam, 10)

    // Validate required parameters
    if (!user || !asset) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'user and asset parameters are required',
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

    console.log(
      `[Balance History API] Fetching history from Dune for user=${user}, asset=${asset}, days=${days}`,
    )

    // Fetch data from Dune Analytics
    const duneResult = await fetchDuneQueryResults(DUNE_QUERY_ID)

    if (!duneResult.result?.rows) {
      throw new Error('No data returned from Dune query')
    }

    // Transform Dune results to UserBalance format
    const allBalances = transformDuneResults(
      duneResult.result.rows as DuneRow[],
      user,
      asset
    )

    // Filter by requested days
    const filteredBalances = filterByDays(allBalances, days)

    // Find first event date (oldest date in the full dataset)
    const firstEventDate = allBalances.length > 0
      ? allBalances[allBalances.length - 1].snapshot_date
      : null

    // Return data with first event date metadata
    const response = {
      user_address: user,
      asset_address: asset,
      days,
      count: filteredBalances.length,
      history: filteredBalances,
      firstEventDate,
    }

    // Return data with 12-hour cache headers
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('[Balance History API] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
