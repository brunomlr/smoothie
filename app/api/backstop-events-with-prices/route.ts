import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'

export interface BackstopEventWithPrice {
  date: string
  lpTokens: number
  priceAtEvent: number
  usdValue: number
  poolAddress: string
  priceSource: 'daily_token_prices' | 'forward_fill' | 'sdk_fallback'
}

export interface BackstopEventsWithPricesResponse {
  deposits: BackstopEventWithPrice[]
  withdrawals: BackstopEventWithPrice[]
}

/**
 * GET /api/backstop-events-with-prices
 *
 * Returns backstop deposit/withdrawal events with historical LP prices.
 *
 * Query params:
 * - userAddress: The user's wallet address
 * - sdkLpPrice: Current LP price from SDK (fallback)
 * - poolAddress: (optional) Filter by pool address
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userAddress = searchParams.get('userAddress')
  const sdkLpPrice = parseFloat(searchParams.get('sdkLpPrice') || '0') || 0
  const poolAddress = searchParams.get('poolAddress') || undefined

  if (!userAddress) {
    return NextResponse.json(
      { error: 'Missing required parameter: userAddress' },
      { status: 400 }
    )
  }

  try {
    const { deposits, withdrawals } = await eventsRepository.getBackstopEventsWithPrices(
      userAddress,
      poolAddress,
      sdkLpPrice
    )

    // Map to response format
    const response: BackstopEventsWithPricesResponse = {
      deposits: deposits.map(d => ({
        date: d.date,
        lpTokens: d.lpTokens,
        priceAtEvent: d.priceAtDeposit,
        usdValue: d.usdValue,
        poolAddress: d.poolAddress,
        priceSource: d.priceSource,
      })),
      withdrawals: withdrawals.map(w => ({
        date: w.date,
        lpTokens: w.lpTokens,
        priceAtEvent: w.priceAtWithdrawal,
        usdValue: w.usdValue,
        poolAddress: w.poolAddress,
        priceSource: w.priceSource,
      })),
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('[API backstop-events-with-prices] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch backstop events with prices' },
      { status: 500 }
    )
  }
}
