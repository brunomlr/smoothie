import { pool } from './config'
import { Q4WResponse, AggregatedQ4WPosition, Q4WSummary, Q4WPool } from '@/types/backstop-q4w'

export class Q4WRepository {
  /**
   * Get all active Q4W positions across all users.
   *
   * Logic:
   * - A Q4W position is created by 'queue_withdrawal' event
   * - A Q4W position is cancelled by 'dequeue_withdrawal' event
   * - A Q4W position is fulfilled by 'withdraw' event (after expiration)
   *
   * We aggregate to get net positions per user/pool.
   */
  async getQ4WPositions(params: {
    poolAddress?: string
    status?: 'all' | 'unlocked' | 'locked'
    orderBy?: 'unlock_time' | 'lp_tokens'
    orderDir?: 'asc' | 'desc'
    limit?: number
    offset?: number
    lpPrice?: number
  }): Promise<Q4WResponse> {
    if (!pool) {
      throw new Error('Database pool not initialized')
    }

    const {
      poolAddress,
      status = 'all',
      orderBy = 'unlock_time',
      orderDir = 'asc',
      limit = 50,
      offset = 0,
      lpPrice = 0,
    } = params

    const currentTimestamp = Math.floor(Date.now() / 1000)

    // Build pool filter
    let poolFilter = ''
    const baseParams: (string | number)[] = [currentTimestamp]
    let paramIndex = 2

    if (poolAddress) {
      poolFilter = `AND pool_address = $${paramIndex}`
      baseParams.push(poolAddress)
      paramIndex++
    }

    // Main query to aggregate Q4W positions
    const mainQuery = `
      WITH q4w_events AS (
        -- All Q4W-related events
        SELECT
          user_address,
          pool_address,
          action_type,
          shares::numeric / 1e7 AS shares,
          q4w_exp
        FROM backstop_events
        WHERE action_type IN ('queue_withdrawal', 'dequeue_withdrawal', 'withdraw')
          AND pool_address IS NOT NULL
          ${poolFilter}
      ),
      -- Calculate net Q4W shares per user/pool/expiration
      net_q4w AS (
        SELECT
          user_address,
          pool_address,
          q4w_exp,
          SUM(CASE
            WHEN action_type = 'queue_withdrawal' THEN shares
            WHEN action_type IN ('dequeue_withdrawal', 'withdraw') THEN -shares
            ELSE 0
          END) AS net_shares
        FROM q4w_events
        WHERE q4w_exp IS NOT NULL
        GROUP BY user_address, pool_address, q4w_exp
        HAVING SUM(CASE
          WHEN action_type = 'queue_withdrawal' THEN shares
          WHEN action_type IN ('dequeue_withdrawal', 'withdraw') THEN -shares
          ELSE 0
        END) > 0.000001
      ),
      -- Get pool share rates for LP token conversion
      pool_rates AS (
        SELECT
          pool_address,
          CASE
            WHEN COALESCE(SUM(CASE
              WHEN action_type = 'deposit' THEN shares::numeric
              WHEN action_type = 'withdraw' THEN -shares::numeric
              ELSE 0
            END), 0) > 0
            THEN COALESCE(SUM(CASE
              WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
              WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
              ELSE 0
            END), 0) / NULLIF(SUM(CASE
              WHEN action_type = 'deposit' THEN shares::numeric
              WHEN action_type = 'withdraw' THEN -shares::numeric
              ELSE 0
            END), 0)
            ELSE 1e7
          END AS share_rate
        FROM backstop_events
        WHERE pool_address IS NOT NULL
        GROUP BY pool_address
      ),
      -- Aggregate per user/pool with locked/unlocked breakdown
      aggregated AS (
        SELECT
          nq.user_address,
          nq.pool_address,
          p.name AS pool_name,
          p.short_name AS pool_short_name,
          -- Locked positions (q4w_exp > current time)
          COALESCE(SUM(CASE WHEN nq.q4w_exp > $1 THEN nq.net_shares ELSE 0 END), 0) AS locked_shares,
          -- Unlocked positions (q4w_exp <= current time)
          COALESCE(SUM(CASE WHEN nq.q4w_exp <= $1 THEN nq.net_shares ELSE 0 END), 0) AS unlocked_shares,
          -- Total
          COALESCE(SUM(nq.net_shares), 0) AS total_shares,
          -- Earliest unlock time for locked positions
          MIN(CASE WHEN nq.q4w_exp > $1 THEN nq.q4w_exp ELSE NULL END) AS earliest_unlock,
          -- Has any unlocked
          BOOL_OR(nq.q4w_exp <= $1) AS has_unlocked,
          -- Share rate for LP conversion
          COALESCE(pr.share_rate / 1e7, 1) AS share_rate
        FROM net_q4w nq
        LEFT JOIN pools p ON nq.pool_address = p.pool_id
        LEFT JOIN pool_rates pr ON nq.pool_address = pr.pool_address
        GROUP BY nq.user_address, nq.pool_address, p.name, p.short_name, pr.share_rate
      )
      SELECT *
      FROM aggregated
      WHERE 1=1
    `

    // Add status filter
    let statusFilter = ''
    if (status === 'unlocked') {
      statusFilter = 'AND has_unlocked = true AND unlocked_shares > 0.000001'
    } else if (status === 'locked') {
      statusFilter = 'AND locked_shares > 0.000001'
    }

    // Determine ordering
    let orderClause = ''
    const direction = orderDir === 'asc' ? 'ASC' : 'DESC'
    if (orderBy === 'unlock_time') {
      // Unlocked first, then by earliest unlock
      orderClause = `ORDER BY
        CASE WHEN unlocked_shares > 0.000001 THEN 0 ELSE 1 END ASC,
        earliest_unlock ${direction} NULLS LAST`
    } else {
      orderClause = `ORDER BY total_shares ${direction}`
    }

    // Count query
    const countQuery = `
      WITH q4w_events AS (
        SELECT user_address, pool_address, action_type, shares::numeric / 1e7 AS shares, q4w_exp
        FROM backstop_events
        WHERE action_type IN ('queue_withdrawal', 'dequeue_withdrawal', 'withdraw')
          AND pool_address IS NOT NULL
          ${poolFilter}
      ),
      net_q4w AS (
        SELECT user_address, pool_address, q4w_exp,
          SUM(CASE WHEN action_type = 'queue_withdrawal' THEN shares ELSE -shares END) AS net_shares
        FROM q4w_events
        WHERE q4w_exp IS NOT NULL
        GROUP BY user_address, pool_address, q4w_exp
        HAVING SUM(CASE WHEN action_type = 'queue_withdrawal' THEN shares ELSE -shares END) > 0.000001
      ),
      aggregated AS (
        SELECT user_address, pool_address,
          COALESCE(SUM(CASE WHEN q4w_exp > $1 THEN net_shares ELSE 0 END), 0) AS locked_shares,
          COALESCE(SUM(CASE WHEN q4w_exp <= $1 THEN net_shares ELSE 0 END), 0) AS unlocked_shares,
          BOOL_OR(q4w_exp <= $1) AS has_unlocked
        FROM net_q4w GROUP BY user_address, pool_address
      )
      SELECT COUNT(*) FROM aggregated WHERE 1=1 ${statusFilter}
    `

    const queryParams = [...baseParams, limit, offset]

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, baseParams),
      pool.query(
        `${mainQuery} ${statusFilter} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        queryParams
      ),
    ])

    const totalCount = parseInt(countResult.rows[0]?.count || '0', 10)

    const results: AggregatedQ4WPosition[] = dataResult.rows.map((row) => {
      const shareRate = parseFloat(row.share_rate) || 1
      const lockedShares = parseFloat(row.locked_shares) || 0
      const unlockedShares = parseFloat(row.unlocked_shares) || 0
      const totalShares = parseFloat(row.total_shares) || 0

      const lockedLpTokens = lockedShares * shareRate
      const unlockedLpTokens = unlockedShares * shareRate
      const totalLpTokens = totalShares * shareRate

      return {
        userAddress: row.user_address,
        poolAddress: row.pool_address,
        poolName: row.pool_name,
        poolShortName: row.pool_short_name,
        lockedShares,
        lockedLpTokens,
        lockedLpTokensUsd: lockedLpTokens * lpPrice,
        unlockedShares,
        unlockedLpTokens,
        unlockedLpTokensUsd: unlockedLpTokens * lpPrice,
        totalShares,
        totalLpTokens,
        totalLpTokensUsd: totalLpTokens * lpPrice,
        earliestUnlock: row.earliest_unlock ? parseInt(row.earliest_unlock) : null,
        hasUnlocked: row.has_unlocked,
      }
    })

    // Get summary
    const summary = await this.getQ4WSummary(poolAddress, lpPrice)

    return {
      results,
      summary,
      totalCount,
      currentTimestamp,
    }
  }

  /**
   * Get summary metrics for Q4W positions
   */
  async getQ4WSummary(poolAddress?: string, lpPrice: number = 0): Promise<Q4WSummary> {
    if (!pool) {
      throw new Error('Database pool not initialized')
    }

    const currentTimestamp = Math.floor(Date.now() / 1000)

    let poolFilter = ''
    const params: (string | number)[] = [currentTimestamp]

    if (poolAddress) {
      poolFilter = 'AND pool_address = $2'
      params.push(poolAddress)
    }

    const result = await pool.query(
      `
      WITH q4w_events AS (
        SELECT user_address, pool_address, action_type, shares::numeric / 1e7 AS shares, q4w_exp
        FROM backstop_events
        WHERE action_type IN ('queue_withdrawal', 'dequeue_withdrawal', 'withdraw')
          AND pool_address IS NOT NULL
          ${poolFilter}
      ),
      net_q4w AS (
        SELECT user_address, pool_address, q4w_exp,
          SUM(CASE WHEN action_type = 'queue_withdrawal' THEN shares ELSE -shares END) AS net_shares
        FROM q4w_events
        WHERE q4w_exp IS NOT NULL
        GROUP BY user_address, pool_address, q4w_exp
        HAVING SUM(CASE WHEN action_type = 'queue_withdrawal' THEN shares ELSE -shares END) > 0.000001
      ),
      pool_rates AS (
        SELECT
          pool_address,
          CASE
            WHEN COALESCE(SUM(CASE
              WHEN action_type = 'deposit' THEN shares::numeric
              WHEN action_type = 'withdraw' THEN -shares::numeric
              ELSE 0
            END), 0) > 0
            THEN COALESCE(SUM(CASE
              WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
              WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
              ELSE 0
            END), 0) / NULLIF(SUM(CASE
              WHEN action_type = 'deposit' THEN shares::numeric
              WHEN action_type = 'withdraw' THEN -shares::numeric
              ELSE 0
            END), 0)
            ELSE 1e7
          END AS share_rate
        FROM backstop_events
        WHERE pool_address IS NOT NULL
        GROUP BY pool_address
      )
      SELECT
        COUNT(DISTINCT nq.user_address) AS total_users,
        COALESCE(SUM(CASE WHEN nq.q4w_exp > $1 THEN nq.net_shares * COALESCE(pr.share_rate / 1e7, 1) ELSE 0 END), 0) AS locked_lp,
        COALESCE(SUM(CASE WHEN nq.q4w_exp <= $1 THEN nq.net_shares * COALESCE(pr.share_rate / 1e7, 1) ELSE 0 END), 0) AS unlocked_lp,
        COALESCE(SUM(nq.net_shares * COALESCE(pr.share_rate / 1e7, 1)), 0) AS total_lp
      FROM net_q4w nq
      LEFT JOIN pool_rates pr ON nq.pool_address = pr.pool_address
    `,
      params
    )

    const row = result.rows[0]

    const lockedLp = parseFloat(row.locked_lp) || 0
    const unlockedLp = parseFloat(row.unlocked_lp) || 0
    const totalLp = parseFloat(row.total_lp) || 0

    return {
      totalUsers: parseInt(row.total_users) || 0,
      totalLpTokensLocked: lockedLp,
      totalLpTokensLockedUsd: lockedLp * lpPrice,
      totalLpTokensUnlocked: unlockedLp,
      totalLpTokensUnlockedUsd: unlockedLp * lpPrice,
      totalLpTokens: totalLp,
      totalLpTokensUsd: totalLp * lpPrice,
    }
  }

  /**
   * Get list of pools that have any Q4W activity
   */
  async getPoolsWithQ4W(): Promise<Q4WPool[]> {
    if (!pool) {
      throw new Error('Database pool not initialized')
    }

    const result = await pool.query(`
      SELECT DISTINCT
        be.pool_address,
        p.name AS pool_name,
        p.short_name AS pool_short_name
      FROM backstop_events be
      LEFT JOIN pools p ON be.pool_address = p.pool_id
      WHERE be.action_type = 'queue_withdrawal'
        AND be.pool_address IS NOT NULL
      ORDER BY p.name
    `)

    return result.rows.map((row) => ({
      poolAddress: row.pool_address,
      poolName: row.pool_short_name || row.pool_name,
    }))
  }
}

export const q4wRepository = new Q4WRepository()
