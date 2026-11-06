-- Migration: Register the Blend V2.1 "Fixed v2.1" pool
-- V2.1 pools use the same contract interface as V2 (SDK Version.V2) but sit
-- behind the V2.1 backstop (CCS4AZ5O…OQMJ), whose backstop token is the
-- Comet V1.1 BLND-USDC LP (CASYAKK3…MIHE) instead of the broken Comet V1 LP.

INSERT INTO pools (pool_id, name, short_name, description, is_active, version) VALUES
  ('CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO', 'Fixed v2.1', 'Fixed v2.1', 'Blend V2.1 Fixed pool', true, 'v2')
ON CONFLICT (pool_id) DO NOTHING;
