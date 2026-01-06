import { pool } from './lib/db/config'

async function debugYieldBreakdown() {
  const userAddress = 'GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J'
  const tz = 'America/Los_Angeles'

  if (!pool) {
    console.log('Pool is null')
    return
  }

  console.log('=== Yield Breakdown for User ===\n')

  // Get user's lending positions
  const lendingPositions = await pool.query(`
    SELECT DISTINCT
      pool_id,
      asset_address
    FROM parsed_events
    WHERE user_address = $1
      AND action_type IN ('supply', 'supply_collateral', 'withdraw', 'withdraw_collateral')
  `, [userAddress])

  console.log(`Lending positions: ${lendingPositions.rows.length}`)
  lendingPositions.rows.forEach(r => {
    console.log(`  Pool: ${r.pool_id.slice(0, 8)}... Asset: ${r.asset_address.slice(0, 8)}...`)
  })

  // Get user's backstop positions
  const backstopPositions = await pool.query(`
    SELECT DISTINCT pool_address
    FROM backstop_events
    WHERE user_address = $1
      AND pool_address IS NOT NULL
  `, [userAddress])

  console.log(`\nBackstop positions: ${backstopPositions.rows.length}`)
  backstopPositions.rows.forEach(r => {
    console.log(`  Pool: ${r.pool_address.slice(0, 8)}...`)
  })

  // Get user's borrow positions
  const borrowPositions = await pool.query(`
    SELECT DISTINCT
      pool_id,
      asset_address
    FROM parsed_events
    WHERE user_address = $1
      AND action_type IN ('borrow', 'repay')
  `, [userAddress])

  console.log(`\nBorrow positions: ${borrowPositions.rows.length}`)
  borrowPositions.rows.forEach(r => {
    console.log(`  Pool: ${r.pool_id.slice(0, 8)}... Asset: ${r.asset_address.slice(0, 8)}...`)
  })

  // Get current balances for lending
  console.log('\n=== Current Lending Balances ===')
  for (const pos of lendingPositions.rows) {
    const balance = await pool.query(`
      WITH user_events AS (
        SELECT
          (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $4)::date AS event_date,
          SUM(CASE
            WHEN action_type = 'supply' THEN amount_tokens
            WHEN action_type = 'withdraw' THEN -amount_tokens
            ELSE 0
          END) AS supply_change,
          SUM(CASE
            WHEN action_type = 'supply_collateral' THEN amount_tokens
            WHEN action_type = 'withdraw_collateral' THEN -amount_tokens
            ELSE 0
          END) AS collateral_change
        FROM parsed_events
        WHERE user_address = $1
          AND pool_id = $2
          AND asset_address = $3
        GROUP BY (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $4)::date
      ),
      cumulative AS (
        SELECT
          event_date,
          SUM(supply_change) OVER (ORDER BY event_date) / 1e7 AS supply_btokens,
          SUM(collateral_change) OVER (ORDER BY event_date) / 1e7 AS collateral_btokens
        FROM user_events
      )
      SELECT * FROM cumulative ORDER BY event_date DESC LIMIT 1
    `, [userAddress, pos.pool_id, pos.asset_address, tz])

    if (balance.rows[0]) {
      const b = balance.rows[0]
      console.log(`  ${pos.asset_address.slice(0, 8)}: supply=${Number(b.supply_btokens).toFixed(2)} collateral=${Number(b.collateral_btokens).toFixed(2)} bTokens`)
    }
  }

  // Get current balances for backstop
  console.log('\n=== Current Backstop Balances ===')
  for (const pos of backstopPositions.rows) {
    const balance = await pool.query(`
      WITH user_events AS (
        SELECT
          SUM(CASE
            WHEN action_type = 'deposit' THEN shares::numeric
            WHEN action_type = 'withdraw' THEN -shares::numeric
            ELSE 0
          END) / 1e7 AS user_shares
        FROM backstop_events
        WHERE user_address = $1
          AND pool_address = $2
      )
      SELECT * FROM user_events
    `, [userAddress, pos.pool_address])

    if (balance.rows[0]) {
      const shares = Number(balance.rows[0].user_shares)
      console.log(`  ${pos.pool_address.slice(0, 8)}: ${shares.toFixed(2)} shares`)
    }
  }

  // Get current balances for borrows
  console.log('\n=== Current Borrow Balances ===')
  for (const pos of borrowPositions.rows) {
    const balance = await pool.query(`
      WITH user_events AS (
        SELECT
          SUM(CASE
            WHEN action_type = 'borrow' THEN amount_tokens
            WHEN action_type = 'repay' THEN -amount_tokens
            ELSE 0
          END) / 1e7 AS debt_dtokens
        FROM parsed_events
        WHERE user_address = $1
          AND pool_id = $2
          AND asset_address = $3
      )
      SELECT * FROM user_events
    `, [userAddress, pos.pool_id, pos.asset_address])

    if (balance.rows[0]) {
      const debt = Number(balance.rows[0].debt_dtokens)
      console.log(`  ${pos.asset_address.slice(0, 8)}: ${debt.toFixed(2)} dTokens`)
    }
  }

  // Estimate daily yield for each position type
  console.log('\n=== Estimated Daily Yield (rough) ===')

  // For lending, estimate based on b_rate growth
  let totalLendingYield = 0
  for (const pos of lendingPositions.rows) {
    const rateChange = await pool.query(`
      SELECT
        (SELECT b_rate FROM daily_rates
         WHERE pool_id = $1 AND asset_address = $2
         ORDER BY rate_date DESC LIMIT 1) AS current_rate,
        (SELECT b_rate FROM daily_rates
         WHERE pool_id = $1 AND asset_address = $2
         ORDER BY rate_date DESC LIMIT 1 OFFSET 1) AS prev_rate
    `, [pos.pool_id, pos.asset_address])

    const balance = await pool.query(`
      WITH cumulative AS (
        SELECT
          SUM(CASE
            WHEN action_type IN ('supply', 'supply_collateral') THEN amount_tokens
            WHEN action_type IN ('withdraw', 'withdraw_collateral') THEN -amount_tokens
            ELSE 0
          END) / 1e7 AS total_btokens
        FROM parsed_events
        WHERE user_address = $1
          AND pool_id = $2
          AND asset_address = $3
      )
      SELECT * FROM cumulative
    `, [userAddress, pos.pool_id, pos.asset_address])

    if (rateChange.rows[0] && balance.rows[0]) {
      const r = rateChange.rows[0]
      const btokens = Number(balance.rows[0].total_btokens)
      const currentRate = Number(r.current_rate) || 1
      const prevRate = Number(r.prev_rate) || currentRate
      const rateGrowth = currentRate - prevRate
      const yieldTokens = btokens * rateGrowth
      // Assume $1 per token for rough estimate (need actual price)
      console.log(`  Lending ${pos.asset_address.slice(0, 8)}: ${btokens.toFixed(2)} bTokens × rate growth ${rateGrowth.toFixed(8)} = ${yieldTokens.toFixed(4)} tokens/day`)
      totalLendingYield += yieldTokens
    }
  }

  // For backstop, estimate based on share rate growth
  let totalBackstopYield = 0
  const lpPrice = 2.80 // Rough estimate
  for (const pos of backstopPositions.rows) {
    const shareRates = await pool.query(`
      WITH pool_totals AS (
        SELECT
          (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS event_date,
          SUM(CASE
            WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
            WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
            ELSE 0
          END) AS lp_change,
          SUM(CASE
            WHEN action_type = 'deposit' THEN shares::numeric
            WHEN action_type = 'withdraw' THEN -shares::numeric
            ELSE 0
          END) AS shares_change
        FROM backstop_events
        WHERE pool_address = $1
        GROUP BY (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date
      ),
      cumulative AS (
        SELECT
          event_date,
          SUM(lp_change) OVER (ORDER BY event_date) AS total_lp,
          SUM(shares_change) OVER (ORDER BY event_date) AS total_shares
        FROM pool_totals
      ),
      with_rate AS (
        SELECT
          event_date,
          total_lp / NULLIF(total_shares, 0) AS share_rate
        FROM cumulative
        WHERE total_shares > 0
      )
      SELECT * FROM with_rate ORDER BY event_date DESC LIMIT 2
    `, [pos.pool_address, tz])

    const userShares = await pool.query(`
      SELECT
        SUM(CASE
          WHEN action_type = 'deposit' THEN shares::numeric
          WHEN action_type = 'withdraw' THEN -shares::numeric
          ELSE 0
        END) / 1e7 AS user_shares
      FROM backstop_events
      WHERE user_address = $1
        AND pool_address = $2
    `, [userAddress, pos.pool_address])

    if (shareRates.rows.length >= 2 && userShares.rows[0]) {
      const currentRate = Number(shareRates.rows[0].share_rate)
      const prevRate = Number(shareRates.rows[1].share_rate)
      const shares = Number(userShares.rows[0].user_shares)
      const rateGrowth = currentRate - prevRate
      const yieldLp = shares * rateGrowth
      const yieldUsd = yieldLp * lpPrice

      console.log(`  Backstop ${pos.pool_address.slice(0, 8)}: ${shares.toFixed(2)} shares × rate growth ${rateGrowth.toFixed(6)} = ${yieldLp.toFixed(4)} LP = $${yieldUsd.toFixed(2)}/day`)
      totalBackstopYield += yieldUsd
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Total estimated lending yield: ${totalLendingYield.toFixed(4)} tokens/day (need price for USD)`)
  console.log(`  Total estimated backstop yield: $${totalBackstopYield.toFixed(2)}/day`)

  await pool.end()
}

debugYieldBreakdown().catch(console.error)
