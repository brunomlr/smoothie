import { pool } from './config'
import { UserBalance } from './types'

export class UserRepository {
  /**
   * Get user balance by joining positions with pool rates
   */
  async getUserBalance(
    userAddress: string,
    assetAddress: string,
    date?: string
  ): Promise<UserBalance | null> {
    if (!pool) {
      throw new Error('Database pool not initialized')
    }

    const dateCondition = date
      ? 'AND p.snapshot_date = $3'
      : 'AND p.snapshot_date = (SELECT MAX(snapshot_date) FROM user_positions)'

    const params = date
      ? [userAddress, assetAddress, date]
      : [userAddress, assetAddress]

    const result = await pool.query(
      `
      SELECT
        p.pool_id,
        p.user_address,
        p.asset_address,
        p.snapshot_date::text,
        p.snapshot_timestamp::text,
        p.ledger_sequence,
        p.supply_btokens,
        p.collateral_btokens,
        p.liabilities_dtokens,
        p.entry_hash,
        p.ledger_entry_change,
        r.b_rate,
        r.d_rate,
        -- Calculate balances
        (p.supply_btokens * r.b_rate) AS supply_balance,
        (p.collateral_btokens * r.b_rate) AS collateral_balance,
        (p.liabilities_dtokens * r.d_rate) AS debt_balance,
        ((p.supply_btokens + p.collateral_btokens) * r.b_rate - p.liabilities_dtokens * r.d_rate) AS net_balance
      FROM user_positions p
      JOIN pool_snapshots r
        ON p.asset_address = r.asset_address
        AND p.snapshot_date = r.snapshot_date
      WHERE p.user_address = $1
        AND p.asset_address = $2
        ${dateCondition}
      LIMIT 1
      `,
      params
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      pool_id: row.pool_id,
      user_address: row.user_address,
      asset_address: row.asset_address,
      snapshot_date: row.snapshot_date,
      snapshot_timestamp: row.snapshot_timestamp,
      ledger_sequence: row.ledger_sequence,
      supply_balance: parseFloat(row.supply_balance),
      collateral_balance: parseFloat(row.collateral_balance),
      debt_balance: parseFloat(row.debt_balance),
      net_balance: parseFloat(row.net_balance),
      supply_btokens: parseFloat(row.supply_btokens),
      collateral_btokens: parseFloat(row.collateral_btokens),
      liabilities_dtokens: parseFloat(row.liabilities_dtokens),
      entry_hash: row.entry_hash,
      ledger_entry_change: row.ledger_entry_change,
      b_rate: parseFloat(row.b_rate),
      d_rate: parseFloat(row.d_rate),
    }
  }

  /**
   * Get user balance history over a date range
   * Shows actual position changes (ledger-based tracking)
   * Returns data for ALL pools for the given asset
   */
  async getUserBalanceHistory(
    userAddress: string,
    assetAddress: string,
    days: number = 30
  ): Promise<{ history: UserBalance[], firstEventDate: string | null }> {
    if (!pool) {
      throw new Error('Database pool not initialized')
    }

    // First, get the absolute first event date for this user/asset combination
    const firstEventResult = await pool.query(
      `
      SELECT MIN(snapshot_date)::text AS first_event_date
      FROM user_positions
      WHERE user_address = $1
        AND asset_address = $2
      `,
      [userAddress, assetAddress]
    )

    const firstEventDate = firstEventResult.rows[0]?.first_event_date || null

    const result = await pool.query(
      `
      WITH date_series AS (
        -- Generate all dates in the range
        SELECT generate_series(
          CURRENT_DATE - $3::integer,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date
      ),
      user_pools AS (
        -- Get all unique pools this user has positions in for this asset
        SELECT DISTINCT pool_id
        FROM user_positions
        WHERE user_address = $1
          AND asset_address = $2
      ),
      date_pool_combinations AS (
        -- Cross join to get every date x pool combination
        SELECT d.date, p.pool_id
        FROM date_series d
        CROSS JOIN user_pools p
      )
      SELECT
        dpc.pool_id,
        $1 AS user_address,
        $2 AS asset_address,
        dpc.date::text AS snapshot_date,
        latest_pos.snapshot_timestamp::text AS snapshot_timestamp,
        COALESCE(latest_pos.ledger_sequence, 0) AS ledger_sequence,
        COALESCE(latest_pos.supply_btokens, 0) AS supply_btokens,
        COALESCE(latest_pos.collateral_btokens, 0) AS collateral_btokens,
        COALESCE(latest_pos.liabilities_dtokens, 0) AS liabilities_dtokens,
        latest_pos.entry_hash,
        latest_pos.ledger_entry_change,
        -- Return raw rate data - application layer will choose which to use
        latest_pos.b_rate AS position_b_rate,
        latest_pos.d_rate AS position_d_rate,
        rates.b_rate AS snapshot_b_rate,
        rates.d_rate AS snapshot_d_rate,
        latest_pos.snapshot_date::text AS position_date
      FROM date_pool_combinations dpc
      -- Get the first position date for this pool (to avoid showing data before position exists)
      LEFT JOIN LATERAL (
        SELECT MIN(snapshot_date) as first_date
        FROM user_positions
        WHERE user_address = $1
          AND asset_address = $2
          AND pool_id = dpc.pool_id
      ) first_date ON true
      -- Get the most recent position for THIS POOL on or before this date
      LEFT JOIN LATERAL (
        SELECT *
        FROM user_positions
        WHERE user_address = $1
          AND asset_address = $2
          AND pool_id = dpc.pool_id
          AND snapshot_date <= dpc.date
        ORDER BY snapshot_date DESC, ledger_sequence DESC
        LIMIT 1
      ) latest_pos ON true
      -- Get the pool rates for THIS specific date and pool
      LEFT JOIN LATERAL (
        SELECT b_rate, d_rate
        FROM pool_snapshots
        WHERE asset_address = $2
          AND pool_id = dpc.pool_id
          AND snapshot_date <= dpc.date
        ORDER BY snapshot_date DESC, ledger_sequence DESC
        LIMIT 1
      ) rates ON true
      -- Only include dates on or after the first position date
      WHERE latest_pos.pool_id IS NOT NULL
        AND dpc.date >= first_date.first_date
      ORDER BY dpc.date DESC, dpc.pool_id
      `,
      [userAddress, assetAddress, days]
    )

    const historyRecords = result.rows.map((row) => {
      // Parse raw values
      const supply_btokens = parseFloat(row.supply_btokens)
      const collateral_btokens = parseFloat(row.collateral_btokens)
      const liabilities_dtokens = parseFloat(row.liabilities_dtokens)

      const position_b_rate = row.position_b_rate
        ? parseFloat(row.position_b_rate)
        : null
      const position_d_rate = row.position_d_rate
        ? parseFloat(row.position_d_rate)
        : null
      const snapshot_b_rate = row.snapshot_b_rate
        ? parseFloat(row.snapshot_b_rate)
        : null
      const snapshot_d_rate = row.snapshot_d_rate
        ? parseFloat(row.snapshot_d_rate)
        : null

      // Rate selection logic: use position rate only if this is the exact position date
      const isExactPositionDate = row.position_date === row.snapshot_date

      const b_rate = isExactPositionDate
        ? (position_b_rate ?? snapshot_b_rate ?? 1.0)
        : (snapshot_b_rate ?? 1.0)

      const d_rate = isExactPositionDate
        ? (position_d_rate ?? snapshot_d_rate ?? 1.0)
        : (snapshot_d_rate ?? 1.0)

      // Calculate balances with selected rates
      const supply_balance = supply_btokens * b_rate
      const collateral_balance = collateral_btokens * b_rate
      const debt_balance = liabilities_dtokens * d_rate
      const net_balance =
        (supply_btokens + collateral_btokens) * b_rate -
        liabilities_dtokens * d_rate

      return {
        pool_id: row.pool_id,
        user_address: row.user_address,
        asset_address: row.asset_address,
        snapshot_date: row.snapshot_date,
        snapshot_timestamp: row.snapshot_timestamp,
        ledger_sequence: row.ledger_sequence,
        supply_balance,
        collateral_balance,
        debt_balance,
        net_balance,
        supply_btokens,
        collateral_btokens,
        liabilities_dtokens,
        entry_hash: row.entry_hash,
        ledger_entry_change: row.ledger_entry_change,
        b_rate,
        d_rate,
        // Debug fields for rate comparison
        position_b_rate,
        position_d_rate,
        snapshot_b_rate,
        snapshot_d_rate,
        position_date: row.position_date,
      }
    })

    return {
      history: historyRecords,
      firstEventDate
    }
  }
}

export const userRepository = new UserRepository()
