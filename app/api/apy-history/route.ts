/**
 * APY History API Route
 * Fetches daily b_rates and calculates historical APY from rate changes
 */

import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'

export interface ApyDataPoint {
  date: string
  apy: number
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const poolId = searchParams.get('pool')
    const asset = searchParams.get('asset')
    const daysParam = searchParams.get('days') || '180' // Default to 6 months

    const days = parseInt(daysParam, 10)

    // Validate required parameters
    if (!poolId || !asset) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'pool and asset parameters are required',
        },
        { status: 400 }
      )
    }

    // Validate days parameter
    if (isNaN(days) || days < 1) {
      return NextResponse.json(
        {
          error: 'Invalid days parameter',
          message: 'days must be a positive number',
        },
        { status: 400 }
      )
    }

    // Fetch daily rates - add 1 extra day to calculate first day's APY
    const rates = await eventsRepository.getDailyRates(asset, poolId, days + 1)

    // Calculate APY from b_rate changes
    const apyHistory = calculateApyFromRates(rates)

    return NextResponse.json(
      {
        pool_id: poolId,
        asset_address: asset,
        days,
        count: apyHistory.length,
        history: apyHistory,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour cache
        },
      }
    )
  } catch (error) {
    console.error('[APY History API] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
