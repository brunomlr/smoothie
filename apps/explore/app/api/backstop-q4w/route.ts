/**
 * Backstop Q4W API Route
 * Returns all Q4W (queued withdrawal) positions across users and pools
 */

import { NextRequest, NextResponse } from 'next/server'
import { q4wRepository } from '@/lib/db/q4w-repository'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const poolAddress = searchParams.get('pool') || undefined
    const status = (searchParams.get('status') || 'all') as 'all' | 'unlocked' | 'locked'
    const orderBy = (searchParams.get('orderBy') || 'unlock_time') as 'unlock_time' | 'lp_tokens'
    const orderDir = (searchParams.get('orderDir') || 'asc') as 'asc' | 'desc'
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)
    const lpPrice = searchParams.get('lpPrice') ? parseFloat(searchParams.get('lpPrice')!) : 0

    const response = await q4wRepository.getQ4WPositions({
      poolAddress,
      status,
      orderBy,
      orderDir,
      limit,
      offset,
      lpPrice,
    })

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('[Backstop Q4W API] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
