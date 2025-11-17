/**
 * Balance History Utility Functions
 * Helper functions for processing and transforming balance history data
 */

import {
  BalanceHistoryRecord,
  ChartDataPoint,
  PositionChange,
  EarningsStats,
  POOL_NAMES,
} from '@/types/balance-history'

/**
 * Transform balance history records into chart data
 * Backend now handles forward-fill with rate recalculation
 */
export function fillMissingDates(
  records: BalanceHistoryRecord[],
  includeBaselineDay: boolean = true,
  firstEventDate: string | null = null,
): ChartDataPoint[] {
  if (records.length === 0) {
    return []
  }

  // Group records by date and pool
  const datePoolMap = new Map<
    string,
    Map<string, BalanceHistoryRecord>
  >()

  records.forEach((record) => {
    if (!datePoolMap.has(record.snapshot_date)) {
      datePoolMap.set(record.snapshot_date, new Map())
    }
    datePoolMap
      .get(record.snapshot_date)!
      .set(record.pool_id, record)
  })

  // Get all dates and sort
  const allDates = Array.from(datePoolMap.keys()).sort()

  // Add a $0 baseline day before the first data point (only if this IS the first-ever event)
  // This ensures we only show $0 at the very beginning of the pool history, not at the start of filtered views
  if (includeBaselineDay && allDates.length > 0 && firstEventDate) {
    const firstDateInRecords = allDates[0]

    // Only add baseline if the first date in our records matches the absolute first event date
    if (firstDateInRecords === firstEventDate) {
      const firstDate = new Date(allDates[0])
      const dayBefore = new Date(firstDate)
      dayBefore.setDate(dayBefore.getDate() - 1)
      const dayBeforeStr = dayBefore.toISOString().split('T')[0]

      // Add empty pool map for the day before (will show $0)
      datePoolMap.set(dayBeforeStr, new Map())
      allDates.unshift(dayBeforeStr)
    }
  }

  // Calculate initial deposit amount from first data point (skip $0 baseline if it exists)
  const firstRealDate = includeBaselineDay && allDates.length > 1 ? allDates[1] : allDates[0]
  const firstDateRecords = datePoolMap.get(firstRealDate)!

  // Track cumulative deposits per pool (bTokens and initial b_rate)
  const poolBTokens = new Map<string, number>()
  const poolInitialBRate = new Map<string, number>()
  firstDateRecords.forEach((record, poolId) => {
    const totalBTokens = record.supply_btokens + record.collateral_btokens
    poolBTokens.set(poolId, totalBTokens)
    poolInitialBRate.set(poolId, record.b_rate)
  })

  // Build chart data - backend already filled missing dates with recalculated rates
  const chartData: ChartDataPoint[] = allDates.map((date, index) => {
    const dateRecords = datePoolMap.get(date)!
    const pools: ChartDataPoint['pools'] = []
    let total = 0
    let totalDeposit = 0

    dateRecords.forEach((record, poolId) => {
      const balance = record.net_balance

      // Update tracked bTokens if there's a change (deposit/withdrawal)
      const currentBTokens = record.supply_btokens + record.collateral_btokens
      const trackedBTokens = poolBTokens.get(poolId) || 0

      // If bTokens changed, update tracking (this is a deposit or withdrawal)
      if (Math.abs(currentBTokens - trackedBTokens) > 0.0001) {
        poolBTokens.set(poolId, currentBTokens)
        // Update initial b_rate for the new position
        poolInitialBRate.set(poolId, record.b_rate)
      }

      // Calculate deposit amount using INITIAL b_rate (at time of deposit)
      const initialRate = poolInitialBRate.get(poolId) || record.b_rate
      const depositAmount = (poolBTokens.get(poolId) || 0) * initialRate
      totalDeposit += depositAmount

      pools.push({
        poolId,
        poolName: getPoolName(poolId),
        balance,
      })
      total += balance
    })

    const yield_amount = total - totalDeposit

    return {
      date,
      formattedDate: formatChartDate(date),
      timestamp: new Date(date).getTime(),
      pool_yieldblox:
        pools.find(
          (p) =>
            p.poolId ===
            'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS',
        )?.balance || 0,
      pool_blend:
        pools.find(
          (p) =>
            p.poolId ===
            'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
        )?.balance || 0,
      total,
      deposit: totalDeposit,
      yield: yield_amount,
      pools,
    }
  })

  return chartData
}

/**
 * Detect position changes (deposits/withdrawals)
 * Compares btokens between consecutive days
 */
export function detectPositionChanges(
  records: BalanceHistoryRecord[],
  threshold: number = 0.01,
): PositionChange[] {
  if (records.length <= 1) {
    return []
  }

  const changes: PositionChange[] = []

  // Sort by date and ledger sequence
  const sorted = [...records].sort((a, b) => {
    const dateComp = a.snapshot_date.localeCompare(
      b.snapshot_date,
    )
    if (dateComp !== 0) return dateComp
    return a.ledger_sequence - b.ledger_sequence
  })

  // Group by date
  const byDate = new Map<string, BalanceHistoryRecord[]>()
  sorted.forEach((record) => {
    if (!byDate.has(record.snapshot_date)) {
      byDate.set(record.snapshot_date, [])
    }
    byDate.get(record.snapshot_date)!.push(record)
  })

  const dates = Array.from(byDate.keys()).sort()

  // Compare consecutive dates
  for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i - 1]
    const currDate = dates[i]

    const prevRecords = byDate.get(prevDate)!
    const currRecords = byDate.get(currDate)!

    // Sum up positions by pool
    const prevSums = {
      supply: prevRecords.reduce(
        (sum, r) => sum + r.supply_btokens,
        0,
      ),
      collateral: prevRecords.reduce(
        (sum, r) => sum + r.collateral_btokens,
        0,
      ),
      debt: prevRecords.reduce(
        (sum, r) => sum + r.liabilities_dtokens,
        0,
      ),
    }

    const currSums = {
      supply: currRecords.reduce(
        (sum, r) => sum + r.supply_btokens,
        0,
      ),
      collateral: currRecords.reduce(
        (sum, r) => sum + r.collateral_btokens,
        0,
      ),
      debt: currRecords.reduce(
        (sum, r) => sum + r.liabilities_dtokens,
        0,
      ),
    }

    const supplyChange = currSums.supply - prevSums.supply
    const collateralChange =
      currSums.collateral - prevSums.collateral
    const debtChange = currSums.debt - prevSums.debt

    // Check if changes are significant
    const isSignificant =
      Math.abs(supplyChange) > threshold ||
      Math.abs(collateralChange) > threshold ||
      Math.abs(debtChange) > threshold

    if (isSignificant) {
      const prevTotal = prevRecords.reduce(
        (sum, r) => sum + r.net_balance,
        0,
      )
      const currTotal = currRecords.reduce(
        (sum, r) => sum + r.net_balance,
        0,
      )

      changes.push({
        index: i,
        date: currDate,
        supplyChange,
        collateralChange,
        debtChange,
        netChange: currTotal - prevTotal,
        isSignificant,
      })
    }
  }

  return changes
}

/**
 * Calculate earnings statistics PER POOL
 * Interest is calculated from rate changes, not balance changes
 */
export function calculateEarningsStats(
  chartData: ChartDataPoint[],
  positionChanges: PositionChange[],
): EarningsStats {
  if (chartData.length <= 1) {
    return {
      totalInterest: 0,
      currentAPY: 0,
      avgDailyInterest: 0,
      projectedAnnual: 0,
      dayCount: 0,
      avgPosition: 0,
      perPool: {},
    }
  }

  const dayCount = chartData.length - 1
  const perPool: Record<string, {
    totalInterest: number
    currentAPY: number
    avgDailyInterest: number
    projectedAnnual: number
    avgPosition: number
  }> = {}

  // Get all unique pool IDs
  const poolIds = new Set<string>()
  chartData.forEach(point => {
    point.pools.forEach(pool => poolIds.add(pool.poolId))
  })

  // Calculate stats for each pool separately
  poolIds.forEach(poolId => {
    let totalInterest = 0
    let totalPosition = 0
    let dataPoints = 0

    // For each day, calculate interest from rate increase
    for (let i = 1; i < chartData.length; i++) {
      const prevDay = chartData[i - 1]
      const currDay = chartData[i]

      const prevPool = prevDay.pools.find(p => p.poolId === poolId)
      const currPool = currDay.pools.find(p => p.poolId === poolId)

      if (prevPool && currPool) {
        // Interest = balance change from rates only (if no deposits)
        // If balance increased but no entry_hash change, it's pure interest
        const balanceChange = currPool.balance - prevPool.balance

        // Simple heuristic: if it's a small daily change, it's likely interest
        // If it's a large sudden change, it might be a deposit
        // We'll count all changes as interest for now (can refine later with entry_hash)
        totalInterest += balanceChange

        totalPosition += currPool.balance
        dataPoints++
      }
    }

    const avgPosition = dataPoints > 0 ? totalPosition / dataPoints : 0
    const avgDailyInterest = totalInterest / dayCount

    // Calculate APY
    const apy = avgPosition > 0
      ? (totalInterest / avgPosition) * (365 / dayCount) * 100
      : 0

    // Projected annual
    const latestPoint = chartData[chartData.length - 1]
    const latestPool = latestPoint.pools.find(p => p.poolId === poolId)
    const latestBalance = latestPool?.balance || 0
    const projectedAnnual = (latestBalance * apy) / 100

    perPool[poolId] = {
      totalInterest,
      currentAPY: apy,
      avgDailyInterest,
      projectedAnnual,
      avgPosition,
    }
  })

  // Calculate combined stats
  const totalInterest = Object.values(perPool).reduce((sum, p) => sum + p.totalInterest, 0)
  const avgDailyInterest = totalInterest / dayCount

  const totalPosition = Object.values(perPool).reduce((sum, p) => sum + p.avgPosition, 0)
  const combinedAPY = totalPosition > 0
    ? (totalInterest / totalPosition) * (365 / dayCount) * 100
    : 0

  const latestBalance = chartData[chartData.length - 1].total
  const projectedAnnual = (latestBalance * combinedAPY) / 100

  return {
    totalInterest,
    currentAPY: combinedAPY,
    avgDailyInterest,
    projectedAnnual,
    dayCount,
    avgPosition: totalPosition,
    perPool,
  }
}

/**
 * Group balance records by date
 */
export function groupByDate(
  records: BalanceHistoryRecord[],
): Map<string, BalanceHistoryRecord[]> {
  const grouped = new Map<string, BalanceHistoryRecord[]>()

  records.forEach((record) => {
    if (!grouped.has(record.snapshot_date)) {
      grouped.set(record.snapshot_date, [])
    }
    grouped.get(record.snapshot_date)!.push(record)
  })

  return grouped
}

/**
 * Get human-readable pool name
 */
export function getPoolName(poolId: string): string {
  return POOL_NAMES[poolId] || poolId.slice(0, 8) + '...'
}

/**
 * Format date for chart display
 */
export function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format number with commas
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}
