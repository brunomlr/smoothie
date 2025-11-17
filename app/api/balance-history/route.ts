/**
 * Balance History API Route
 * Queries balance history directly from Neon DB
 */

import { NextRequest, NextResponse } from 'next/server'
import { userRepository } from '@/lib/db/user-repository'

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
      `[Balance History API] Fetching history for user=${user}, asset=${asset}, days=${days}`,
    )

    // Query database directly
    const history = await userRepository.getUserBalanceHistory(
      user,
      asset,
      days,
    )

    // Return data in the same format as the backfill_backend API
    const response = {
      user_address: user,
      asset_address: asset,
      days,
      count: history.length,
      history,
    }

    // Return data with cache headers
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
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
