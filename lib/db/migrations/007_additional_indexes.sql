-- Migration: Add additional performance indexes
-- Description: Composite index for daily_rates + additional backstop coverage
-- Impact: Faster rate lookups and backstop queries
-- Date: 2026-01

-- Composite index for daily_rates asset lookups
-- Covers: getDailyRates() queries that filter by asset_address and sort by rate_date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_rates_asset_date
  ON daily_rates(asset_address, rate_date DESC);

-- Additional backstop indexes for better query coverage
-- Covers: user balance history queries with date ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backstop_events_user_time
  ON backstop_events(user_address, ledger_closed_at DESC);

-- Composite index for pool + action filtering
-- Covers: queries filtering by pool and action type together
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backstop_events_pool_action
  ON backstop_events(pool_address, action_type);

-- Date-based index for reporting
-- Covers: date range queries on backstop events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backstop_events_time
  ON backstop_events(ledger_closed_at DESC);

-- Comments for documentation
COMMENT ON INDEX idx_daily_rates_asset_date IS 'Asset-based rate lookups with date ordering';
COMMENT ON INDEX idx_backstop_events_user_time IS 'User backstop history with time ordering';
COMMENT ON INDEX idx_backstop_events_pool_action IS 'Pool + action type filtering';
COMMENT ON INDEX idx_backstop_events_time IS 'Date range queries on backstop events';
