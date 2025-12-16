/**
 * Backstop Cost Basis API Route
 * Fetches backstop cost basis (deposited - withdrawn LP tokens) for a user
 */

import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import { getAnalyticsUserIdFromRequest, captureServerEvent } from '@/lib/analytics-server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const user = searchParams.get('user')
    const poolId = searchParams.get('pool') || undefined
    const analyticsUserId = getAnalyticsUserIdFromRequest(request)

    // Validate required parameters
    if (!user) {
      return NextResponse.json(
        {
          error: 'Missing required parameter',
          message: 'user parameter is required',
        },
        { status: 400 },
      )
    }

    // If pool is specified, get cost basis for that pool only
    // Otherwise, get cost basis for all pools
    if (poolId) {
      const costBasis = await eventsRepository.getBackstopCostBasis(user, poolId)

      captureServerEvent(analyticsUserId, {
        event: 'backstop_cost_basis_fetched',
        properties: {
          wallet_address: user,
          pool_id: poolId,
          has_position: !!costBasis,
        },
        $set: { last_wallet_address: user },
      })

      return NextResponse.json({
        user_address: user,
        cost_bases: costBasis ? [costBasis] : [],
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      })
    }

    const costBases = await eventsRepository.getAllBackstopCostBases(user)

    captureServerEvent(analyticsUserId, {
      event: 'backstop_cost_basis_fetched',
      properties: {
        wallet_address: user,
        pool_count: costBases.length,
      },
      $set: { last_wallet_address: user },
    })

    return NextResponse.json({
      user_address: user,
      cost_bases: costBases,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('[Backstop Cost Basis API] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
