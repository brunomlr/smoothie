import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'

export interface RealizedYieldTransaction {
  date: string
  type: 'deposit' | 'withdraw' | 'claim'
  source: 'pool' | 'backstop'
  asset: string
  amount: number
  priceUsd: number
  valueUsd: number
  txHash: string
  poolId: string
  poolName: string | null
}

export interface RealizedYieldResponse {
  // Summary
  totalDepositedUsd: number
  totalWithdrawnUsd: number
  realizedPnl: number

  // Breakdown by source
  pools: {
    deposited: number
    withdrawn: number
    realized: number
  }
  backstop: {
    deposited: number
    withdrawn: number
    realized: number
  }
  emissions: {
    blndClaimed: number
    lpClaimed: number
    usdValue: number
  }

  // Performance metrics
  roiPercent: number | null
  annualizedRoiPercent: number | null
  daysActive: number

  // Metadata
  firstActivityDate: string | null
  lastActivityDate: string | null

  // Time series for charting
  cumulativeRealized: Array<{
    date: string
    cumulativeDeposited: number
    cumulativeWithdrawn: number
    cumulativeRealized: number
  }>

  // Transaction list
  transactions: RealizedYieldTransaction[]
}

/**
 * GET /api/realized-yield
 *
 * Returns realized yield data for a user.
 * Realized yield = Total withdrawn (at historical prices) - Total deposited (at historical prices)
 *
 * Query params:
 * - userAddress: The user's wallet address (required)
 * - sdkBlndPrice: Current BLND price from SDK (optional fallback)
 * - sdkLpPrice: Current LP token price from SDK (optional fallback)
 * - sdkPrices: JSON object of token address -> price (optional fallback)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userAddress = searchParams.get('userAddress')
  const sdkBlndPrice = parseFloat(searchParams.get('sdkBlndPrice') || '0') || 0
  const sdkLpPrice = parseFloat(searchParams.get('sdkLpPrice') || '0') || 0
  const sdkPricesJson = searchParams.get('sdkPrices')

  if (!userAddress) {
    return NextResponse.json(
      { error: 'Missing required parameter: userAddress' },
      { status: 400 }
    )
  }

  try {
    console.log('[API realized-yield] Fetching data for:', userAddress)

    // Build SDK prices map
    const sdkPrices = new Map<string, number>()

    // Add BLND and LP prices if provided
    const LP_TOKEN_ADDRESS = 'CDMHROXQ75GEMEJ4LJCT4TUFKY7PH5Z7V5RCVS4KKGU2CQLQRN35DKFT'
    const BLND_TOKEN_ADDRESS = 'CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY'

    if (sdkBlndPrice > 0) {
      sdkPrices.set(BLND_TOKEN_ADDRESS, sdkBlndPrice)
    }
    if (sdkLpPrice > 0) {
      sdkPrices.set(LP_TOKEN_ADDRESS, sdkLpPrice)
    }

    // Parse additional SDK prices if provided
    if (sdkPricesJson) {
      try {
        const parsed = JSON.parse(sdkPricesJson)
        for (const [address, price] of Object.entries(parsed)) {
          if (typeof price === 'number' && price > 0) {
            sdkPrices.set(address, price)
          }
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    console.log('[API realized-yield] SDK prices:', {
      sdkBlndPrice,
      sdkLpPrice,
      sdkPricesCount: sdkPrices.size,
      hasLpPrice: sdkPrices.has(LP_TOKEN_ADDRESS),
    })

    const data = await eventsRepository.getRealizedYieldData(userAddress, sdkPrices)

    console.log('[API realized-yield] Got data:', {
      totalDepositedUsd: data.totalDepositedUsd,
      totalWithdrawnUsd: data.totalWithdrawnUsd,
      transactionCount: data.transactions.length,
      poolsDeposited: data.pools.deposited,
      backstopDeposited: data.backstop.deposited,
      backstopWithdrawn: data.backstop.withdrawn,
    })

    // Calculate cumulative time series for charting
    const cumulativeRealized: Array<{
      date: string
      cumulativeDeposited: number
      cumulativeWithdrawn: number
      cumulativeRealized: number
    }> = []

    let cumDeposited = 0
    let cumWithdrawn = 0

    // Group transactions by date and calculate running totals
    const dateMap = new Map<string, { deposited: number; withdrawn: number }>()

    for (const tx of data.transactions) {
      const existing = dateMap.get(tx.date) || { deposited: 0, withdrawn: 0 }

      if (tx.type === 'deposit') {
        existing.deposited += tx.valueUsd
      } else {
        // withdrawals and claims count as withdrawn
        existing.withdrawn += tx.valueUsd
      }

      dateMap.set(tx.date, existing)
    }

    // Convert to sorted array with cumulative values
    const sortedDates = Array.from(dateMap.keys()).sort()
    for (const date of sortedDates) {
      const dayData = dateMap.get(date)!
      cumDeposited += dayData.deposited
      cumWithdrawn += dayData.withdrawn

      cumulativeRealized.push({
        date,
        cumulativeDeposited: cumDeposited,
        cumulativeWithdrawn: cumWithdrawn,
        cumulativeRealized: cumWithdrawn - cumDeposited,
      })
    }

    // Calculate ROI
    let roiPercent: number | null = null
    if (data.totalDepositedUsd > 0) {
      roiPercent = (data.realizedPnl / data.totalDepositedUsd) * 100
    }

    // Calculate annualized ROI
    let annualizedRoiPercent: number | null = null
    let daysActive = 0

    if (data.firstActivityDate && data.lastActivityDate) {
      const firstDate = new Date(data.firstActivityDate)
      const lastDate = new Date(data.lastActivityDate)
      daysActive = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)))

      if (roiPercent !== null && daysActive > 0) {
        // Annualize: (1 + ROI)^(365/days) - 1
        const roiDecimal = roiPercent / 100
        if (roiDecimal > -1) {
          annualizedRoiPercent = (Math.pow(1 + roiDecimal, 365 / daysActive) - 1) * 100
        }
      }
    }

    const response: RealizedYieldResponse = {
      totalDepositedUsd: data.totalDepositedUsd,
      totalWithdrawnUsd: data.totalWithdrawnUsd,
      realizedPnl: data.realizedPnl,
      pools: data.pools,
      backstop: data.backstop,
      emissions: data.emissions,
      roiPercent,
      annualizedRoiPercent,
      daysActive,
      firstActivityDate: data.firstActivityDate,
      lastActivityDate: data.lastActivityDate,
      cumulativeRealized,
      transactions: data.transactions,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('[API realized-yield] Error:', error)
    console.error('[API realized-yield] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[API realized-yield] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: 'Failed to fetch realized yield data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
