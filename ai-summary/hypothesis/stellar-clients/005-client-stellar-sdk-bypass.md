# H005: Regular-wallet hooks ship Stellar SDK and bypass shared server caches

**Date**: 2026-05-20
**Subsystem**: stellar-clients
**Severity**: Medium
**Impact**: Client bundle growth / cache bypass
**Hypothesis by**: gpt-5.4, high

## Expected Behavior

Wallet views should reuse the existing `/api/*` server layer for Horizon and Soroban reads so requests benefit from shared HTTP caching, Redis caching, and server-side connection reuse. Client bundles for the wallet page should not need to include Stellar SDK runtime code just to fetch public account, balance, and token-balance data.

## Mechanism

The hooks special-case demo wallets to call the backend, but regular wallets execute Horizon and Soroban SDK calls directly in the browser. That means the wallet page pulls Stellar client code into the client bundle and every browser session repeats the same upstream Horizon/RPC work independently, bypassing `createApiHandler`, Redis, and any server-side keep-alive opportunities.

## Trigger

Open the wallet page with a normal public key instead of a `demo-*` alias. The non-demo branches of `useHorizonBalances()` and `useTokenBalance()` should instantiate Stellar clients in the client module graph and perform direct upstream requests rather than calling `/api/horizon-balances`, `/api/account`, or `/api/token-balance`.

## Target Code

- `components/wallet-content/wallet-content.tsx:WalletContent:73-77,269-273` - wallet page consumes `useHorizonBalances()` and `useTokenBalance()`
- `hooks/use-horizon-balances.ts:useHorizonBalances:191-307` - non-demo branch directly loads the Horizon account and issuer metadata in the browser
- `hooks/use-token-balance.ts:useTokenBalance:1-88` - client path imports runtime `@stellar/stellar-sdk` symbols and simulates the token contract directly
- `lib/stellar/horizon.ts:getHorizonServer:9-15` - thin factory used inside the client hook
- `lib/stellar/rpc.ts:getSorobanRpc:3-16` - thin RPC factory used inside the client hook

## Evidence

`use-horizon-balances.ts` is a client module and calls `getHorizonServer()` for regular wallets, while `use-token-balance.ts` imports `Contract`, `Address`, `TransactionBuilder`, `BASE_FEE`, and `Networks` from `@stellar/stellar-sdk` and runs the Soroban simulation directly on the client. The API routes already exist for the same data, but regular wallets bypass them entirely.

## Anti-Evidence

Direct client calls avoid one extra hop through Next.js for regular wallets, so tiny single-wallet sessions may see acceptable latency. The route path is still used for demo wallets, which means the server-side implementation already exists and could be reused if the bundle/cache tradeoff proves material.
