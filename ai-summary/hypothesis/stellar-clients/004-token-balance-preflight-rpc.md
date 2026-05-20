# H004: Token balance query doubles Soroban RPC work with preflight getAccount

**Date**: 2026-05-20
**Subsystem**: stellar-clients
**Severity**: Low
**Impact**: Redundant Soroban round trip
**Hypothesis by**: gpt-5.4, high

## Expected Behavior

A read-only token `balance()` simulation should require one Soroban RPC call per refresh. The query should build from a reusable dummy account or another cached source account so a warm refetch does not need to fetch the wallet account state first when the transaction is never submitted.

## Mechanism

Both the backend route and the regular-wallet client hook call `rpc.getAccount(userAddress)` and only then call `simulateTransaction(transaction)`. That adds an extra network RTT in front of every balance read, even though the same repository already uses dummy accounts for read-only simulations in `reflector-oracle.ts` and `lib/blend/comet.ts`.

## Trigger

Open a single-wallet page that renders the LP token balance, wait past the 30-second `staleTime`, or refocus the page after the query goes stale. Each refresh should execute `getAccount(user)` followed by `simulateTransaction(...)` instead of a single read-only simulation.

## Target Code

- `app/api/token-balance/route.ts:GET:41-68` - route does `rpc.getAccount(userAddress)` before simulating `balance()`
- `hooks/use-token-balance.ts:useTokenBalance:39-67` - regular-wallet client path repeats the same two-step RPC sequence
- `lib/stellar/reflector-oracle.ts:DUMMY_ACCOUNT usage:23-25,73-78,104-109` - existing read-only oracle path shows the codebase already accepts dummy-account simulation
- `lib/blend/comet.ts:simulateCometDeposit:91-131` - another read-only simulation path uses a fixed dummy account instead of fetching the user's account first

## Evidence

The token-balance route fetches `sourceAccount = await rpc.getAccount(userAddress)` and then constructs a read-only `balance` contract call for `simulateTransaction`. The client hook repeats the same logic, so the cost is paid both on the API path for demo wallets and on the browser path for regular wallets.

## Anti-Evidence

Today this query is only used for the LP token balance in single-wallet mode, so the blast radius is limited. If the SDK or RPC server requires a live source account for some token contracts, the dummy-account approach may need a small compatibility guard before being generalized.
