# H001: Public cache headers on wallet-address routes leak per-user data

**Date**: 2026-05-20
**Subsystem**: stellar-clients
**Severity**: High
**Impact**: shared-cache correctness
**Hypothesis by**: gpt-5.4, high

## Expected Behavior

If a Stellar-backed route returns data that varies by private user context, it should not emit `Cache-Control: public` because shared caches must never serve one user's personalized payload to another. The correct behavior would be to mark the response private or to key it on the exact public inputs that fully determine the result.

## Mechanism

The initial hypothesis was that `createApiHandler()` emits `public, s-maxage=...` for routes like `/api/account`, `/api/horizon-balances`, `/api/wallet-operations`, and `/api/token-balance`, which might allow a CDN to serve one caller another caller's wallet payload. That would be significant if the handlers depended on hidden session state or private request headers.

## Trigger

Request the same wallet-address route through a shared cache using different callers and inspect whether the cached response can vary without the URL changing.

## Target Code

- `lib/api/responses.ts:getCacheHeaders:33-40` - always emits `public, s-maxage=...` for configured cache entries
- `app/api/account/route.ts:GET:33-78` - cached wallet-address route
- `app/api/horizon-balances/route.ts:GET:64-142` - cached wallet-address route
- `app/api/wallet-operations/route.ts:GET:167-262` - cached wallet-address route
- `app/api/token-balance/route.ts:GET:29-89` - cached wallet-address route
- `lib/api/resolve-wallet.ts:resolveWalletAddress:31-49` - demonstrates inputs resolve to public Stellar addresses, not private user state

## Evidence

`CACHE_CONFIGS.SHORT` expands to `public, s-maxage=60, stale-while-revalidate=120`, and all four Stellar-backed routes use that cache config. At first glance, that looks like the "public cache on user-specific API route" pattern from the audit checklist.

## Anti-Evidence

These handlers are keyed by explicit wallet and contract query parameters and return public on-chain data for those addresses. `resolveWalletAddress()` only maps a `demo-*` alias to another public Stellar address; the response does not depend on cookies, auth state, or any secret per-user context.

---

## Review

**Verdict**: NOT_VIABLE
**Date**: 2026-05-20
**Failed At**: hypothesis
**Novelty**: PASS — not previously investigated

### Why It Failed

The cached payloads are derived entirely from public wallet-address inputs, so shared caching is intentional and does not create a meaningful performance or correctness issue by itself in this subsystem.

### Lesson Learned

Only flag `Cache-Control: public` when the response varies by hidden user/session state or another non-public dimension; public blockchain reads keyed by explicit wallet address do not meet that bar.
