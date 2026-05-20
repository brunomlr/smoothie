# H001: Oracle price route re-simulates unchanged 5-minute oracle data

**Date**: 2026-05-20
**Subsystem**: stellar-clients
**Severity**: Medium
**Impact**: RPC fanout / cache miss amplification
**Hypothesis by**: gpt-5.4, high

## Expected Behavior

Repeated `/api/oracle-prices` requests for the same assets inside the Reflector oracle's 5-minute update window should reuse a cached price result keyed by contract ID and oracle timestamp, or at least reuse one cached batch result for the requested asset set. Warm-cache returning users should not force a fresh Soroban simulation for every asset on every 30-second refetch when the underlying on-chain price has not changed.

## Mechanism

`fetchPrices()` only caches the supported-asset set, not the actual prices, and then always calls `getOraclePrices()` for every request. `getOraclePrices()` fans out to one `simulateTransaction()` per asset, so a returning user with 15-20 supported assets still triggers 15-20 mainnet Soroban RPC POSTs every 30 seconds even though the oracle contract itself only updates every 5 minutes.

## Trigger

Open wallet views for a realistic multi-wallet session with 3-5 wallets and 10-20 unique supported assets, then let the page sit past the 30-second TanStack Query `staleTime`. During a single 5-minute oracle window, repeated refreshes should continue to hit `/api/oracle-prices` and re-run per-asset simulations even though the returned `timestamp` stays unchanged.

## Target Code

- `app/api/oracle-prices/route.ts:fetchPrices:212-266` - every request calls `getOraclePrices()` after only filtering against the cached supported-asset set
- `lib/stellar/reflector-oracle.ts:getOraclePrice:94-127` - each asset price is fetched with its own `simulateTransaction()`
- `lib/stellar/reflector-oracle.ts:getOraclePrices:134-155` - batch helper does not reuse prior results or cache by oracle timestamp
- `hooks/use-horizon-balances.ts:fetchOraclePrices:71-118` - single-wallet path posts asset lists to `/api/oracle-prices`
- `components/wallet-content/wallet-content.tsx:sharedPriceMap query:125-171` - multi-wallet path posts all unique assets again every 30 seconds

## Evidence

The only cache in this path is `getSupportedAssetsSet()` in `app/api/oracle-prices/route.ts:84-110`, which stores the supported contract IDs. The actual price response is returned with `Cache-Control: private, max-age=60`, but the handler still recomputes by calling `getOraclePrices()` on every request, and `getOraclePrice()` does not cache by `(contractId, timestamp)` even though the result already contains the oracle timestamp.

## Anti-Evidence

The supported-asset lookup is cached in memory and Redis, so the route avoids re-simulating the oracle `assets()` call on hot paths. The client also batches all requested assets into one HTTP request, which prevents a larger browser-side N+1 pattern, but the server still performs a fresh per-asset Soroban simulation batch each time.

---

## Review

**Verdict**: VIABLE
**Severity**: Medium
**Date**: 2026-05-20
**Reviewed by**: claude-opus-4-6, high
**Novelty**: PASS — not previously investigated

### Trace Summary

Traced from client-side TanStack Query hooks through the `/api/oracle-prices` POST handler to `getOraclePrices()` and individual `getOraclePrice()` Soroban simulations. Both the single-wallet path (`use-horizon-balances.ts:72-118`) and multi-wallet path (`wallet-content.tsx:126-171`) POST to `/api/oracle-prices` with 30-second `staleTime`. The handler's `fetchPrices()` function only caches the supported-asset set (via `getSupportedAssetsSet()` with in-memory + Redis), then unconditionally fans out N `simulateTransaction()` RPC calls via `getOraclePrices()`. No layer caches actual price results despite the oracle updating only every 5 minutes.

### Code Paths Examined

- `hooks/use-horizon-balances.ts:fetchOraclePrices:71-118` — POST to `/api/oracle-prices` with all asset codes/issuers. No `cache` option on fetch, and POST requests are not browser-cached.
- `components/wallet-content/wallet-content.tsx:126-171` — Multi-wallet TanStack Query with `staleTime: 30 * 1000`, POSTs all unique assets to `/api/oracle-prices`.
- `hooks/use-horizon-balances.ts:306` — Single-wallet query also uses `staleTime: 30 * 1000`.
- `app/api/oracle-prices/route.ts:fetchPrices:212-266` — Calls `getSupportedAssetsSet()` (cached) then `getOraclePrices(supportedRequests)` (not cached). Returns `Cache-Control: private, max-age=60` but this is irrelevant for POST responses.
- `lib/stellar/reflector-oracle.ts:getOraclePrices:134-155` — Maps each asset to a separate `getOraclePrice()` promise, awaits via `Promise.allSettled`. No result caching.
- `lib/stellar/reflector-oracle.ts:getOraclePrice:94-127` — Per-asset: `new rpc.Server()` (per call!), builds a transaction, calls `simulateTransaction()`. No cache of any kind.
- `lib/stellar/reflector-oracle.ts:getServer:39-41` — Creates a brand-new `rpc.Server` instance on every call, compounding the overhead.
- `lib/redis/cache.ts:getOrSet:44-78` — The `getOrSet` helper is available and already used for the supported-asset set, but is never applied to price results.

### Findings

**The inefficiency is confirmed and sits on a hot path.** For a typical multi-wallet user with 15-20 oracle-supported assets:

- Every 30 seconds, TanStack Query considers data stale and triggers a re-fetch.
- Both client paths use `POST`, so browser HTTP caching (`max-age=60`) provides no protection.
- The server fans out to 15-20 independent `simulateTransaction()` calls against mainnet Soroban RPC.
- The oracle updates every 5 minutes, so within each 5-minute window, approximately 9 out of 10 server-side fetches return identical price data.
- Per 5-minute window per active user: ~150-200 wasted Soroban RPC calls.
- Each call also instantiates a new `rpc.Server` (fresh Axios client), so there's no HTTP connection reuse.

**No existing optimization covers this.** The `getSupportedAssetsSet()` cache only avoids re-fetching the asset list. The `CACHE_TTL.SHORT` (60s) and `CACHE_TTL.MEDIUM` (5min) constants from `lib/redis/cache.ts` are already available and could be applied directly.

**The fix is straightforward and safe.** Price results are pure reads from on-chain state with no user-specific dimension. Caching by contractId with a TTL of 60-120 seconds (or keyed by the oracle `timestamp` field in the result) would eliminate ~80-95% of redundant RPC calls with zero correctness risk.

### PoC Guidance

- **Target code**: `app/api/oracle-prices/route.ts:fetchPrices` (lines 212-266) and optionally `lib/stellar/reflector-oracle.ts:getOraclePrices` (lines 134-155)
- **Change description**: Wrap the `getOraclePrices()` call in `fetchPrices()` with the existing `getOrSet()` Redis cache helper, keyed by a sorted hash of the requested contractIds and using `CACHE_TTL.SHORT` (60 seconds). Alternatively, add a module-level in-memory cache (similar to the `supportedAssetsCache` pattern at lines 79-82) keyed by contractId with a 60-second TTL, applied inside `getOraclePrice()` itself. The two-layer approach (in-memory + Redis) used by `getSupportedAssetsSet()` is the ideal template since it's already proven in this same file.
- **Correctness check**: No automated tests exist. Verify via `npm run build`, `npx tsc --noEmit`, `npm run lint`. Ensure the cache key includes all inputs that determine the result (contractId is sufficient since the oracle contract and network are constants). Verify that `null` / error results are NOT cached (a failed simulation should retry on the next request).
- **Benchmark focus**: Soroban RPC call count per 5-minute oracle window per user session. Current: ~150-200 calls. Expected after fix: ~15-20 calls (one batch per unique cache miss). Secondary metric: response latency of `/api/oracle-prices` on warm cache (should drop from ~2-5s to <50ms).
