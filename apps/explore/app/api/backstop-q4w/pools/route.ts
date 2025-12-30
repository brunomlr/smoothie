/**
 * Backstop Q4W Pools API Route
 * Returns list of pools that have Q4W activity
 */

import { NextResponse } from 'next/server'
import { q4wRepository } from '@/lib/db/q4w-repository'

export async function GET() {
  try {
    const pools = await q4wRepository.getPoolsWithQ4W()

    return NextResponse.json(
      { pools },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('[Backstop Q4W Pools API] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
