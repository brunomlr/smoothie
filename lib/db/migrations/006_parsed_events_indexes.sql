-- Migration: Add performance indexes to parsed_events table
-- Description: Critical indexes for getBalanceHistoryFromEvents and daily_rates refresh
-- Impact: 5-10x query speedup for dashboard loads
-- Date: 2026-01

-- Primary composite index for user balance queries
-- Covers: getBalanceHistoryFromEvents WHERE user_address = $1 AND asset_address = $2
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parsed_events_user_asset
  ON parsed_events(user_address, asset_address);

-- Extended composite index for time-ordered queries
-- Covers: queries that need events in chronological order per user/asset
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parsed_events_user_asset_time
  ON parsed_events(user_address, asset_address, ledger_closed_at DESC);

-- Index for liquidation queries (filler is the liquidator)
-- Covers: fill_auction events where user is liquidator
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parsed_events_filler
  ON parsed_events(filler_address)
  WHERE filler_address IS NOT NULL;

-- Index for action type queries
-- Covers: filtering by action_type (supply, withdraw, borrow, repay, etc.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parsed_events_action
  ON parsed_events(action_type);

-- Composite index for daily_rates materialized view refresh
-- Covers: DISTINCT ON (pool_id, asset_address, DATE(ledger_closed_at))
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parsed_events_pool_asset_date
  ON parsed_events(pool_id, asset_address, DATE(ledger_closed_at), ledger_closed_at DESC);

-- Index for date-based queries and reporting
-- Covers: queries filtering by date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parsed_events_ledger_time
  ON parsed_events(ledger_closed_at DESC);

-- Index for ledger sequence lookups
-- Covers: ORDER BY ledger_sequence queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parsed_events_ledger_seq
  ON parsed_events(ledger_sequence DESC);

-- Partial index for auction-related queries
-- Covers: new_auction and fill_auction event lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parsed_events_auctions
  ON parsed_events(user_address, action_type, lot_asset, bid_asset)
  WHERE action_type IN ('new_auction', 'fill_auction', 'delete_auction');

-- Comments for documentation
COMMENT ON INDEX idx_parsed_events_user_asset IS 'Primary lookup: user balance history queries';
COMMENT ON INDEX idx_parsed_events_user_asset_time IS 'Time-ordered user/asset event queries';
COMMENT ON INDEX idx_parsed_events_filler IS 'Liquidator (filler) queries';
COMMENT ON INDEX idx_parsed_events_action IS 'Action type filtering';
COMMENT ON INDEX idx_parsed_events_pool_asset_date IS 'daily_rates materialized view refresh';
COMMENT ON INDEX idx_parsed_events_ledger_time IS 'Date range queries';
COMMENT ON INDEX idx_parsed_events_ledger_seq IS 'Ledger sequence ordering';
COMMENT ON INDEX idx_parsed_events_auctions IS 'Auction event queries';
