import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import { LP_TOKEN_ADDRESS, BLND_TOKEN_ADDRESS } from '@/lib/constants'
import { getAllDatesBetween, getToday, getFirstDateFromMap, getFirstDateFromSet } from '@/lib/date-utils'
import { resolveWalletAddress } from '@/lib/api/resolve-wallet'
import { fetchRemediationPayments } from '@/lib/reports/remediation'

export interface RealizedYieldTransaction {
  date: string
  type: 'deposit' | 'withdraw' | 'claim'
  source: 'pool' | 'backstop'
  /** Synthetic rows: liquidation legs and incident-remediation payments */
  kind?: 'liquidation' | 'remediation'
  /** Claim that was auto-restaked into the backstop (never left the protocol) */
  restaked?: boolean
  asset: string
  assetAddress: string | null
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
    /** Full earned value, including auto-restaked LP claims */
    usdValue: number
    /** Only claims that actually reached the wallet (cash-flow view) */
    receivedUsdValue: number
  }

  /** Incident-remediation payments received (included in realizedPnl) */
  reimbursementsUsd: number
  /** Liquidation fills whose debt leg is missing from the DB (proceeds counted as 0) */
  liquidationDataGaps: number

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
    cumulativeRealizedPnl: number
  }>

  // Per-source time series for charting
  cumulativeBySource: {
    pools: Array<{
      date: string
      cumulativeDeposited: number
      cumulativeWithdrawn: number
      cumulativeRealizedPnl: number
    }>
    backstop: Array<{
      date: string
      cumulativeDeposited: number
      cumulativeWithdrawn: number
      cumulativeRealizedPnl: number
    }>
  }

  // Per-pool time series for charting (stacked bar chart)
  cumulativeByPool: Array<{
    poolId: string
    poolName: string | null
    timeSeries: Array<{
      date: string
      lendingRealizedPnl: number
      backstopRealizedPnl: number
    }>
  }>

  // Transaction list
  transactions: RealizedYieldTransaction[]
}

/**
 * GET /api/realized-yield
 *
 * Returns realized yield data for a user or multiple users (aggregated).
 * Realized yield = Total withdrawn (at historical prices) - Total deposited (at historical prices)
 *
 * Query params:
 * - userAddress: Single user's wallet address (for backward compatibility)
 * - userAddresses: Comma-separated list of wallet addresses (for multi-wallet aggregation)
 * - sdkBlndPrice: Current BLND price from SDK (optional fallback)
 * - sdkLpPrice: Current LP token price from SDK (optional fallback)
 * - sdkPrices: JSON object of token address -> price (optional fallback)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userAddress = searchParams.get('userAddress')
  const userAddressesParam = searchParams.get('userAddresses')
  const sdkBlndPrice = parseFloat(searchParams.get('sdkBlndPrice') || '0') || 0
  const sdkLpPrice = parseFloat(searchParams.get('sdkLpPrice') || '0') || 0
  const sdkPricesJson = searchParams.get('sdkPrices')

  // Support both single address and multiple addresses
  let userAddressParams: string[] = []
  if (userAddressesParam) {
    userAddressParams = userAddressesParam.split(',').map(a => a.trim()).filter(a => a.length > 0)
  } else if (userAddress) {
    userAddressParams = [userAddress]
  }

  if (userAddressParams.length === 0) {
    return NextResponse.json(
      { error: 'Missing required parameter: userAddress or userAddresses' },
      { status: 400 }
    )
  }

  // Resolve demo wallet aliases to real addresses
  // Dedupe after alias resolution: the same wallet listed twice (or an alias
  // plus its resolved address) would double-count every event in the totals
  const userAddresses = [...new Set(userAddressParams.map(addr => resolveWalletAddress(addr)))]

  try {
    // Build SDK prices map
    const sdkPrices = new Map<string, number>()

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

    // Fetch data for all addresses in parallel; remediation payments are
    // best-effort (a Horizon outage must not block the performance page)
    const [allData, allRemediations] = await Promise.all([
      Promise.all(userAddresses.map(addr => eventsRepository.getRealizedYieldData(addr, sdkPrices))),
      Promise.all(
        userAddresses.map(addr =>
          fetchRemediationPayments(addr).catch(error => {
            console.warn('[Performance API] remediation scan failed:', error)
            return { payments: [], truncated: false }
          })
        )
      ),
    ])

    // Turn remediation payments into synthetic 'withdraw' transactions (value
    // returned from the protocol ecosystem) attributed to the related pool,
    // so totals, ROI and the cumulative series all include them.
    const remediationPayments = allRemediations.flatMap(r => r.payments)
    const remediationTransactions: RealizedYieldTransaction[] = await Promise.all(
      remediationPayments.map(async payment => {
        const day = payment.date.slice(0, 10)
        const { price } = await eventsRepository.getHistoricalPriceAtDate(payment.tokenAddress, day, 1)
        const relatedPool = await eventsRepository.getPool(payment.relatedPoolId)
        return {
          date: day,
          type: 'withdraw' as const,
          source: 'pool' as const,
          kind: 'remediation' as const,
          asset: payment.assetCode,
          assetAddress: payment.tokenAddress,
          amount: payment.quantity,
          priceUsd: price,
          valueUsd: payment.quantity * price,
          txHash: payment.txHash,
          poolId: payment.relatedPoolId,
          poolName: relatedPool?.name ?? null,
        }
      })
    )
    const reimbursementsUsd = remediationTransactions.reduce((sum, tx) => sum + tx.valueUsd, 0)

    // Aggregate data from all wallets (reimbursements count as pool proceeds)
    const data = {
      totalDepositedUsd: allData.reduce((sum, d) => sum + d.totalDepositedUsd, 0),
      totalWithdrawnUsd: allData.reduce((sum, d) => sum + d.totalWithdrawnUsd, 0) + reimbursementsUsd,
      realizedPnl: allData.reduce((sum, d) => sum + d.realizedPnl, 0) + reimbursementsUsd,
      pools: {
        deposited: allData.reduce((sum, d) => sum + d.pools.deposited, 0),
        withdrawn: allData.reduce((sum, d) => sum + d.pools.withdrawn, 0) + reimbursementsUsd,
        realized: allData.reduce((sum, d) => sum + d.pools.realized, 0) + reimbursementsUsd,
      },
      backstop: {
        deposited: allData.reduce((sum, d) => sum + d.backstop.deposited, 0),
        withdrawn: allData.reduce((sum, d) => sum + d.backstop.withdrawn, 0),
        realized: allData.reduce((sum, d) => sum + d.backstop.realized, 0),
      },
      emissions: {
        blndClaimed: allData.reduce((sum, d) => sum + d.emissions.blndClaimed, 0),
        lpClaimed: allData.reduce((sum, d) => sum + d.emissions.lpClaimed, 0),
        usdValue: allData.reduce((sum, d) => sum + d.emissions.usdValue, 0),
        receivedUsdValue: allData.reduce((sum, d) => sum + d.emissions.receivedUsdValue, 0),
      },
      reimbursementsUsd,
      liquidationDataGaps: allData.reduce((sum, d) => sum + d.liquidationDataGaps, 0),
      // Use earliest first activity date and latest last activity date
      firstActivityDate: allData
        .map(d => d.firstActivityDate)
        .filter((d): d is string => d !== null)
        .sort()[0] ?? null,
      lastActivityDate: allData
        .map(d => d.lastActivityDate)
        .filter((d): d is string => d !== null)
        .sort()
        .reverse()[0] ?? null,
      // Combine all transactions
      transactions: [...allData.flatMap(d => d.transactions), ...remediationTransactions]
        .sort((a, b) => a.date.localeCompare(b.date)),
    }

    // Group transactions by date and calculate running totals
    const dateMap = new Map<string, { deposited: number; withdrawn: number; realizedPnl: number }>()

    for (const tx of data.transactions) {
      // Restaked claims never left the protocol — excluded from cash-flow
      // series, matching the summary totals
      if (tx.restaked) continue

      const existing = dateMap.get(tx.date) || { deposited: 0, withdrawn: 0, realizedPnl: 0 }

      if (tx.type === 'deposit') {
        existing.deposited += tx.valueUsd
      } else if (tx.type === 'claim') {
        // Claims are pure realized profit
        existing.withdrawn += tx.valueUsd
        existing.realizedPnl += tx.valueUsd
      } else if (tx.kind === 'remediation') {
        // Reimbursements are pure realized profit (they offset prior losses)
        existing.withdrawn += tx.valueUsd
        existing.realizedPnl += tx.valueUsd
      } else {
        // Regular withdrawals count as withdrawn but not as realized P&L
        existing.withdrawn += tx.valueUsd
      }

      dateMap.set(tx.date, existing)
    }

    // Calculate cumulative time series for charting (with all days filled in)
    const cumulativeRealized: Array<{
      date: string
      cumulativeDeposited: number
      cumulativeWithdrawn: number
      cumulativeRealized: number
      cumulativeRealizedPnl: number
    }> = []

    // Use today's date as the end date for charts
    const today = getToday()

    if (data.firstActivityDate) {
      const allDates = getAllDatesBetween(data.firstActivityDate, today)
      let cumDeposited = 0
      let cumWithdrawn = 0
      let cumRealizedPnl = 0

      for (const date of allDates) {
        const dayData = dateMap.get(date)
        if (dayData) {
          cumDeposited += dayData.deposited
          cumWithdrawn += dayData.withdrawn
          cumRealizedPnl += dayData.realizedPnl
        }

        cumulativeRealized.push({
          date,
          cumulativeDeposited: cumDeposited,
          cumulativeWithdrawn: cumWithdrawn,
          cumulativeRealized: cumWithdrawn - cumDeposited,
          cumulativeRealizedPnl: cumRealizedPnl,
        })
      }
    }

    // Calculate per-source cumulative time series
    const poolsDateMap = new Map<string, { deposited: number; withdrawn: number; realizedPnl: number }>()
    const backstopDateMap = new Map<string, { deposited: number; withdrawn: number; realizedPnl: number }>()

    for (const tx of data.transactions) {
      if (tx.restaked) continue

      const targetMap = tx.source === 'pool' ? poolsDateMap : backstopDateMap
      const existing = targetMap.get(tx.date) || { deposited: 0, withdrawn: 0, realizedPnl: 0 }

      if (tx.type === 'deposit') {
        existing.deposited += tx.valueUsd
      } else if (tx.type === 'claim' || tx.kind === 'remediation') {
        existing.withdrawn += tx.valueUsd
        existing.realizedPnl += tx.valueUsd
      } else {
        existing.withdrawn += tx.valueUsd
      }

      targetMap.set(tx.date, existing)
    }

    // Build pools cumulative series (with all days filled in)
    const poolsCumulative: Array<{ date: string; cumulativeDeposited: number; cumulativeWithdrawn: number; cumulativeRealizedPnl: number }> = []
    const poolsFirstDate = getFirstDateFromMap(poolsDateMap)
    if (poolsFirstDate) {
      const allDates = getAllDatesBetween(poolsFirstDate, today)
      let poolsCumDeposited = 0, poolsCumWithdrawn = 0, poolsCumRealizedPnl = 0

      for (const date of allDates) {
        const dayData = poolsDateMap.get(date)
        if (dayData) {
          poolsCumDeposited += dayData.deposited
          poolsCumWithdrawn += dayData.withdrawn
          poolsCumRealizedPnl += dayData.realizedPnl
        }
        poolsCumulative.push({
          date,
          cumulativeDeposited: poolsCumDeposited,
          cumulativeWithdrawn: poolsCumWithdrawn,
          cumulativeRealizedPnl: poolsCumRealizedPnl,
        })
      }
    }

    // Build backstop cumulative series (with all days filled in)
    const backstopCumulative: Array<{ date: string; cumulativeDeposited: number; cumulativeWithdrawn: number; cumulativeRealizedPnl: number }> = []
    const backstopFirstDate = getFirstDateFromMap(backstopDateMap)
    if (backstopFirstDate) {
      const allDates = getAllDatesBetween(backstopFirstDate, today)
      let backstopCumDeposited = 0, backstopCumWithdrawn = 0, backstopCumRealizedPnl = 0

      for (const date of allDates) {
        const dayData = backstopDateMap.get(date)
        if (dayData) {
          backstopCumDeposited += dayData.deposited
          backstopCumWithdrawn += dayData.withdrawn
          backstopCumRealizedPnl += dayData.realizedPnl
        }
        backstopCumulative.push({
          date,
          cumulativeDeposited: backstopCumDeposited,
          cumulativeWithdrawn: backstopCumWithdrawn,
          cumulativeRealizedPnl: backstopCumRealizedPnl,
        })
      }
    }

    // Build per-pool cumulative time series (for stacked bar chart)
    const poolDateMaps = new Map<string, {
      poolName: string | null
      lending: Map<string, number>
      backstop: Map<string, number>
    }>()

    for (const tx of data.transactions) {
      if (tx.type !== 'claim') continue // Only track claims/emissions for realized P&L
      if (tx.restaked) continue // Restaked claims realize when the LP is withdrawn

      let poolData = poolDateMaps.get(tx.poolId)
      if (!poolData) {
        poolData = {
          poolName: tx.poolName,
          lending: new Map(),
          backstop: new Map(),
        }
        poolDateMaps.set(tx.poolId, poolData)
      }

      const targetMap = tx.source === 'pool' ? poolData.lending : poolData.backstop
      const existing = targetMap.get(tx.date) || 0
      targetMap.set(tx.date, existing + tx.valueUsd)
    }

    // Build cumulative time series for each pool
    const cumulativeByPool: Array<{
      poolId: string
      poolName: string | null
      timeSeries: Array<{
        date: string
        lendingRealizedPnl: number
        backstopRealizedPnl: number
      }>
    }> = []

    for (const [poolId, poolData] of poolDateMaps) {
      // Find first activity date for this pool
      const allDatesSet = new Set([...poolData.lending.keys(), ...poolData.backstop.keys()])
      const firstDate = getFirstDateFromSet(allDatesSet)
      if (!firstDate) continue

      const allDates = getAllDatesBetween(firstDate, today)

      let cumLending = 0
      let cumBackstop = 0
      const timeSeries: Array<{ date: string; lendingRealizedPnl: number; backstopRealizedPnl: number }> = []

      for (const date of allDates) {
        const lendingValue = poolData.lending.get(date) || 0
        const backstopValue = poolData.backstop.get(date) || 0
        cumLending += lendingValue
        cumBackstop += backstopValue

        timeSeries.push({
          date,
          lendingRealizedPnl: cumLending,
          backstopRealizedPnl: cumBackstop,
        })
      }

      cumulativeByPool.push({
        poolId,
        poolName: poolData.poolName,
        timeSeries,
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

    if (data.firstActivityDate) {
      const firstDate = new Date(data.firstActivityDate)
      const todayDate = new Date(today) // today is already defined above as YYYY-MM-DD string
      daysActive = Math.max(1, Math.ceil((todayDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)))

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
      reimbursementsUsd: data.reimbursementsUsd,
      liquidationDataGaps: data.liquidationDataGaps,
      roiPercent,
      annualizedRoiPercent,
      daysActive,
      firstActivityDate: data.firstActivityDate,
      lastActivityDate: data.lastActivityDate,
      cumulativeRealized,
      cumulativeBySource: {
        pools: poolsCumulative,
        backstop: backstopCumulative,
      },
      cumulativeByPool,
      transactions: data.transactions,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch realized yield data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
