# H002: Balance enrichment serializes issuer home_domain lookups

**Date**: 2026-05-20
**Subsystem**: stellar-clients
**Severity**: Medium
**Impact**: Horizon waterfall / issuer metadata fanout
**Hypothesis by**: gpt-5.4, high

## Expected Behavior

Wallet balance enrichment should fetch issuer `home_domain` metadata in one shared cached pass per issuer, with latency that stays close to one Horizon round trip plus bounded parallelism. Adding more assets or more wallets should not create additional serialized waves of issuer-account fetches once the issuer set is known.

## Mechanism

Both the API route and the client hook dedupe issuers only within a single wallet response, then iterate in a `for` loop that awaits `Promise.allSettled()` per batch of five issuers. In multi-wallet mode, `WalletContent` launches one `/api/horizon-balances` request per wallet, so the total latency becomes proportional to the number of issuer batches across all wallets, with no cross-request cache for repeated issuers.

## Trigger

Load a 3-5 wallet session where each wallet holds 8-12 non-native assets from distinct issuers. On cold cache, each `/api/horizon-balances` response should perform one `loadAccount(user)` plus multiple serial issuer batches before the page can render enriched balances with `homeDomain`.

## Target Code

- `app/api/horizon-balances/route.ts:fetchHomeDomains:33-62` - serial `for` loop over issuer batches of five
- `app/api/horizon-balances/route.ts:GET:64-142` - route always enriches balances by calling `fetchHomeDomains()`
- `components/wallet-content/wallet-content.tsx:multiWalletQueries:81-103` - multi-wallet mode issues one `horizon-balances` request per selected wallet
- `hooks/use-horizon-balances.ts:fetchHomeDomainsFromHorizon:121-150` - regular-wallet client path duplicates the same batched issuer lookup logic in the browser

## Evidence

`fetchHomeDomains()` and `fetchHomeDomainsFromHorizon()` both create a `getHorizonServer()` instance, then process issuers in `BATCH_SIZE = 5` chunks with `await Promise.allSettled(...)` inside a loop. There is no Redis layer, module cache, or request-level memo shared across wallets, so repeated issuers across multiple wallets still trigger fresh Horizon account loads.

## Anti-Evidence

The code does dedupe issuers within each wallet and limits concurrency to five, which reduces burst pressure on Horizon. Wallets that only hold native XLM or a small number of repeated issuers will not hit the worst case.
