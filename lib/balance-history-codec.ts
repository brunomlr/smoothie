import type { BalanceHistoryPoint } from '@/types/balance-history'

/**
 * Columnar wire format for /api/balance-history-batch.
 *
 * A year of history for a handful of assets is thousands of rows, and as an
 * array of objects most of the bytes were repeated key names plus the same
 * 56-character pool id on every row. Columns with a dictionary for the two
 * string columns cut the payload roughly 5x.
 */
export interface BalanceHistoryColumns {
  /** Dictionary of pool ids; `p` indexes into this. */
  pools: string[]
  /** Dictionary of snapshot dates; `d` indexes into this. */
  dates: string[]
  p: number[]
  d: number[]
  /** supply_balance */
  sb: number[]
  /** collateral_balance */
  cb: number[]
  /** debt_balance */
  db: number[]
  /** supply_btokens */
  sbt: number[]
  /** collateral_btokens */
  cbt: number[]
  /** liabilities_dtokens */
  ld: number[]
  /** b_rate */
  br: number[]
  /** total_cost_basis */
  tcb: (number | null)[]
  /** total_yield */
  ty: (number | null)[]
  /** borrow_cost_basis */
  bcb: (number | null)[]
}

export const EMPTY_BALANCE_HISTORY_COLUMNS: BalanceHistoryColumns = {
  pools: [], dates: [], p: [], d: [],
  sb: [], cb: [], db: [], sbt: [], cbt: [], ld: [], br: [], tcb: [], ty: [], bcb: [],
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function nullableNum(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Accepts any row carrying the columns below; the DB rows are a superset. */
export function encodeBalanceHistory(
  rows: ReadonlyArray<Omit<BalanceHistoryPoint, 'net_balance' | 'total_cost_basis' | 'total_yield'> & {
    total_cost_basis?: number | null
    total_yield?: number | null
  }>,
): BalanceHistoryColumns {
  const columns: BalanceHistoryColumns = {
    pools: [], dates: [], p: [], d: [],
    sb: [], cb: [], db: [], sbt: [], cbt: [], ld: [], br: [], tcb: [], ty: [], bcb: [],
  }
  const poolIndex = new Map<string, number>()
  const dateIndex = new Map<string, number>()

  for (const row of rows) {
    let pi = poolIndex.get(row.pool_id)
    if (pi === undefined) {
      pi = columns.pools.push(row.pool_id) - 1
      poolIndex.set(row.pool_id, pi)
    }
    let di = dateIndex.get(row.snapshot_date)
    if (di === undefined) {
      di = columns.dates.push(row.snapshot_date) - 1
      dateIndex.set(row.snapshot_date, di)
    }

    columns.p.push(pi)
    columns.d.push(di)
    columns.sb.push(num(row.supply_balance))
    columns.cb.push(num(row.collateral_balance))
    columns.db.push(num(row.debt_balance))
    columns.sbt.push(num(row.supply_btokens))
    columns.cbt.push(num(row.collateral_btokens))
    columns.ld.push(num(row.liabilities_dtokens))
    columns.br.push(num(row.b_rate))
    columns.tcb.push(nullableNum(row.total_cost_basis))
    columns.ty.push(nullableNum(row.total_yield))
    columns.bcb.push(nullableNum(row.borrow_cost_basis))
  }

  return columns
}

export function decodeBalanceHistory(
  columns: BalanceHistoryColumns | undefined | null,
): BalanceHistoryPoint[] {
  if (!columns?.p) {
    return []
  }

  const rows: BalanceHistoryPoint[] = new Array(columns.p.length)
  for (let i = 0; i < columns.p.length; i++) {
    const supplyBalance = columns.sb[i]
    const collateralBalance = columns.cb[i]
    const debtBalance = columns.db[i]
    rows[i] = {
      pool_id: columns.pools[columns.p[i]],
      snapshot_date: columns.dates[columns.d[i]],
      supply_balance: supplyBalance,
      collateral_balance: collateralBalance,
      debt_balance: debtBalance,
      // Exactly how the repository computes it, so it is derived not sent.
      net_balance: supplyBalance + collateralBalance - debtBalance,
      supply_btokens: columns.sbt[i],
      collateral_btokens: columns.cbt[i],
      liabilities_dtokens: columns.ld[i],
      b_rate: columns.br[i],
      total_cost_basis: columns.tcb[i],
      total_yield: columns.ty[i],
      borrow_cost_basis: columns.bcb[i],
    }
  }
  return rows
}
