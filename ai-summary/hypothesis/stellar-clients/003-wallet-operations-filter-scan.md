# H003: Filtered wallet activity may scan ten Horizon pages before first paint

**Date**: 2026-05-20
**Subsystem**: stellar-clients
**Severity**: Medium
**Impact**: Sequential Horizon pagination
**Hypothesis by**: gpt-5.4, high

## Expected Behavior

Fetching the first page of wallet activity should usually require one backend Horizon request, or at least a small bounded amount of extra work that does not scale with how many filtered-out records precede the visible ones. Spam and dust records should not be able to delay delivery of the first 50 visible operations by forcing repeated serial page fetches.

## Mechanism

`wallet-operations` fetches descending Horizon pages, parses them, and only then filters out `create_claimable_balance` records and tiny inbound XLM dust payments. If an account has long stretches of filtered records, the handler stays inside the `while` loop and performs page fetches one after another until it accumulates enough visible items or reaches `maxIterations = 10`, so the first render waits on a serial scan through history.

## Trigger

Request `/api/wallet-operations?user=<spam-heavy-wallet>&limit=50` for an address that has a large number of dust payments or claimable-balance spam near the head of the feed. The response path should keep calling `query.call()` until it has 50 post-filter records, potentially traversing up to ten pages before the hook can render anything.

## Target Code

- `app/api/wallet-operations/route.ts:shouldIncludeOperation + loop:180-250` - filters are applied after each Horizon page is fetched
- `app/api/wallet-operations/route.ts:GET:167-262` - route accumulates filtered results in a serial `while` loop
- `hooks/use-wallet-operations.ts:useWalletOperations:33-66` - infinite query blocks first-page rendering on the route's serial scan

## Evidence

The route initializes `operations = []`, then repeatedly calls `server.operations().forAccount(userAddress).order("desc").limit(limit).call()`, pushing only filtered records until `operations.length >= limit`. `maxIterations = 10` confirms the author already expects this loop to revisit Horizon multiple times in some real accounts.

## Anti-Evidence

Many wallets will finish in a single page because their recent history already contains enough visible records. The ten-iteration cap also prevents an unbounded loop, so the issue is latency growth rather than infinite work.
