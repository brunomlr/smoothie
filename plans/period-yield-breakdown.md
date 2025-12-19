# Plan: Period-Specific Yield Breakdown

## Current State

### How All-Time Yield Breakdown Works

The working all-time calculation is in `/app/api/cost-basis-historical/route.ts`:

1. **Get all deposit/withdrawal events** via `eventsRepository.getDepositEventsWithPrices()`
2. **Each event has historical price** from `daily_token_prices` table (forward-fill if exact date missing)
3. **Calculate**:
   - `netDepositedTokens` = Σ(deposited tokens) - Σ(withdrawn tokens)
   - `costBasisHistorical` = Σ(deposit_tokens × deposit_price) - Σ(withdrawal_tokens × withdrawal_price)
   - `weightedAvgDepositPrice` = costBasisHistorical / netDepositedTokens

4. **Client-side calculation** (with current balance from SDK):
   - `protocolYieldTokens` = currentTokens - netDepositedTokens
   - `protocolYieldUsd` = protocolYieldTokens × currentPrice
   - `priceChangeUsd` = netDepositedTokens × (currentPrice - weightedAvgDepositPrice)
   - `totalEarned` = protocolYieldUsd + priceChangeUsd

### Key Insight

The formula works because:
- **Protocol Yield** = tokens earned from interest (not from deposits)
- **Price Change** = appreciation on tokens that were DEPOSITED (at their original cost basis)

---

## What's Needed for Period Calculations (1W, 1M, 1Y)

For a period starting at date `T_start` and ending at `T_now`:

### Data Required

1. **At Period Start (T_start)**:
   - Token balance (from balance history - already have)
   - Token price (from `daily_token_prices` - already have via `useChartHistoricalPrices`)
   - **Cost basis up to T_start** (need to calculate from events before T_start)
   - **Weighted avg deposit price up to T_start** (derived from cost basis)

2. **During Period (T_start to T_now)**:
   - Deposit/withdrawal events with their historical prices
   - Net tokens deposited/withdrawn during period

3. **At Period End (T_now)**:
   - Current token balance (from SDK - already have)
   - Current price (from SDK - already have)

### Formulas for Period

```
# Tokens
tokensAtStart = balance history at T_start
tokensNow = current SDK balance
netDepositedInPeriod = Σ(deposits in period) - Σ(withdrawals in period)
interestEarnedTokens = tokensNow - tokensAtStart - netDepositedInPeriod

# Protocol Yield (interest earned × current price)
protocolYieldUsd = interestEarnedTokens × currentPrice

# Price Change (only on tokens held at period start)
priceChangeUsd = tokensAtStart × (currentPrice - priceAtStart)

# Total
totalEarnedUsd = protocolYieldUsd + priceChangeUsd
```

---

## Can the Current API Be Adapted?

### YES - The infrastructure exists

The `getUserActions()` function in `events-repository.ts` already supports date filtering:
```typescript
startDate?: string
endDate?: string
```

However, `getDepositEventsWithPrices()` does NOT currently pass these parameters.

### Required Changes

#### 1. Modify `getDepositEventsWithPrices()` (events-repository.ts:1315)

Add optional date range parameters:

```typescript
async getDepositEventsWithPrices(
  userAddress: string,
  assetAddress: string,
  poolId?: string,
  sdkPrice: number = 0,
  startDate?: string,  // NEW
  endDate?: string     // NEW
): Promise<...>
```

Then filter the SQL query:
```sql
WHERE pe.user_address = $1 AND pe.asset_address = $2
  AND pe.ledger_closed_at >= $startDate::date  -- if provided
  AND pe.ledger_closed_at < ($endDate::date + interval '1 day')  -- if provided
```

#### 2. Create New API Endpoint: `/api/period-yield-breakdown`

**Request:**
```typescript
{
  userAddress: string
  period: '1W' | '1M' | '1Y'
  sdkPrices: Record<string, number>
  currentBalances: Record<string, number>  // poolId-assetAddress -> current tokens
}
```

**Response:**
```typescript
{
  byAsset: Record<string, {
    tokensAtStart: number
    priceAtStart: number
    valueAtStart: number
    tokensNow: number
    priceNow: number
    valueNow: number
    netDepositedInPeriod: number
    interestEarnedTokens: number
    protocolYieldUsd: number
    priceChangeUsd: number
    totalEarnedUsd: number
  }>
  totals: {
    valueAtStart: number
    valueNow: number
    protocolYieldUsd: number
    priceChangeUsd: number
    totalEarnedUsd: number
    totalEarnedPercent: number
  }
  periodStartDate: string
}
```

#### 3. Implementation Steps

**Step 1: Get events BEFORE period start (for tokensAtStart)**
- Call `getDepositEventsWithPrices()` with `endDate = periodStartDate`
- Calculate: tokensAtStart = Σ(deposits) - Σ(withdrawals)

**Step 2: Get events WITHIN period (for netDepositedInPeriod)**
- Call `getDepositEventsWithPrices()` with `startDate = periodStartDate`
- Calculate: netDepositedInPeriod = Σ(deposits) - Σ(withdrawals)

**Step 3: Get price at period start**
- Query `daily_token_prices` for each asset at periodStartDate

**Step 4: Calculate breakdown**
```typescript
const interestTokens = tokensNow - tokensAtStart - netDepositedInPeriod
const protocolYield = interestTokens * priceNow
const priceChange = tokensAtStart * (priceNow - priceAtStart)
const totalEarned = protocolYield + priceChange
```

---

## Alternative: Simpler Approach Using Balance History

Since we already have `getBalanceHistoryFromEvents()` which returns daily balances with `total_deposits` and `total_withdrawals` running totals:

1. Get balance at period start date from existing history data
2. Get current balance from SDK
3. Calculate:
   - `tokensAtStart` = supply_balance + collateral_balance from history at start
   - `depositsAtStart` = total_deposits from history at start
   - `withdrawalsAtStart` = total_withdrawals from history at start
   - `depositsNow` = current total from events
   - `withdrawalsNow` = current total from events
   - `netDepositedInPeriod` = (depositsNow - depositsAtStart) - (withdrawalsNow - withdrawalsAtStart)

This approach reuses existing data already fetched for the chart.

---

## Recommendation

**Go with the simpler approach first** (using balance history data) since:
1. Balance history already has cumulative deposits/withdrawals
2. Historical prices are already fetched for the chart
3. Less API changes needed

**Implementation:**
1. Ensure balance history includes `total_deposits` and `total_withdrawals` in the returned data
2. Calculate period breakdown in the existing `usePeriodYieldBreakdown` hook using:
   - Balance history data (already fetched)
   - Historical prices (already fetched via `useChartHistoricalPrices`)
   - Current balances from SDK (already have)

---

## Data Verification

Before implementing, verify the data is available:

1. **Balance history raw data** - Does it include `total_deposits` and `total_withdrawals`?
   - Check: The `UserBalance` type in `lib/db/types.ts`
   - Check: The `getBalanceHistoryFromEvents()` returns these fields

2. **Historical prices** - Are they being passed to the breakdown hook?
   - Check: `useChartHistoricalPrices` is called with correct dates
   - Check: The hook receives the prices map

3. **Matching dates** - Is the period start date in the balance history?
   - May need to find closest date on or before period start

---

## Data Verification Results

### Finding: `UserBalance` type is MISSING required fields

The `UserBalance` type in `lib/db/types.ts` does NOT include:
- `total_deposits` (individual cumulative deposits)
- `total_withdrawals` (individual cumulative withdrawals)

It only has `total_cost_basis` which is computed as `GREATEST(0, deposits - withdrawals)` - the GREATEST(0, ...) clamp loses information when withdrawals exceed deposits.

The SQL query in `getBalanceHistoryFromEvents()` DOES calculate these values (`pos.total_deposits`, `pos.total_withdrawals`) but they are not exposed in the returned data.

---

## Recommended Solution: API Modification Approach

Since the balance history approach has data gaps, **modify the API** to support period filtering:

### Step 1: Modify `getDepositEventsWithPrices()`

File: `lib/db/events-repository.ts` (line 1315)

Add date range parameters:
```typescript
async getDepositEventsWithPrices(
  userAddress: string,
  assetAddress: string,
  poolId?: string,
  sdkPrice: number = 0,
  startDate?: string,  // NEW: filter events on or after this date
  endDate?: string     // NEW: filter events before this date
): Promise<{
  deposits: Array<{ date, tokens, priceAtDeposit, usdValue, poolId, priceSource }>
  withdrawals: Array<{ date, tokens, priceAtWithdrawal, usdValue, poolId, priceSource }>
}>
```

### Step 2: Create `/api/period-yield-breakdown` endpoint

**Logic:**
1. Get ALL events up to period start → calculate `tokensAtStart`
2. Get events WITHIN period → calculate `netDepositedInPeriod`
3. Get price at period start from `daily_token_prices`
4. Use current balance from client (SDK) as `tokensNow`
5. Calculate:
   ```
   interestTokens = tokensNow - tokensAtStart - netDepositedInPeriod
   protocolYieldUsd = interestTokens × priceNow
   priceChangeUsd = tokensAtStart × (priceNow - priceAtStart)
   totalEarnedUsd = protocolYieldUsd + priceChangeUsd
   ```

### Step 3: Create client hook `usePeriodYieldBreakdownAPI`

Call the new API with:
- User address
- Selected period (1W, 1M, 1Y)
- SDK prices (current)
- Current balances from SDK

---

## Alternative: Expose Raw Fields in Balance History

If we prefer keeping calculations client-side:

1. Update `UserBalance` type to include:
   ```typescript
   total_deposits?: number
   total_withdrawals?: number
   ```

2. Update `getBalanceHistoryFromEvents()` to return these:
   ```typescript
   return {
     ...existing fields,
     total_deposits: parseFloat(row.total_deposits) || 0,
     total_withdrawals: parseFloat(row.total_withdrawals) || 0,
   }
   ```

3. Then period calculation in hook:
   ```typescript
   const depositsAtStart = historyAtStart.total_deposits
   const withdrawalsAtStart = historyAtStart.total_withdrawals
   const depositsNow = latestHistory.total_deposits  // or from cost-basis API
   const withdrawalsNow = latestHistory.total_withdrawals
   const netDepositedInPeriod = (depositsNow - depositsAtStart) - (withdrawalsNow - withdrawalsAtStart)
   ```

**Caveat**: This doesn't give us USD values at deposit time for period events. We'd still need historical prices.

---

## Recommended Implementation Order

1. **Modify `getDepositEventsWithPrices()`** to accept `startDate` and `endDate` parameters
2. **Create `/api/period-yield-breakdown`** endpoint that:
   - Calls `getDepositEventsWithPrices()` twice (before period, within period)
   - Gets historical price at period start
   - Returns calculated breakdown
3. **Create `usePeriodYieldBreakdownAPI` hook** to call the endpoint
4. **Integrate into wallet-balance.tsx** to display period breakdown

This approach:
- Keeps all complex calculations server-side
- Uses accurate historical prices for all events
- Avoids modifying balance history types
- Is consistent with how the all-time calculation works
