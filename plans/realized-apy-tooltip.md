# Add Realized APY to Tooltip

## Goal
Add back the "Realized APY" calculation to both tooltip sections, showing the actual annualized yield performance.

## Formula
```
Realized APY = (protocolYield / valueAtStart) * (365 / periodDays) * 100
```

This takes the yield earned over the period and annualizes it to show what the equivalent yearly APY would be.

## Data Available

### Period-specific tooltip (lines 639-673)
From `periodYieldBreakdownAPI`:
- `totals.protocolYieldUsd` - yield earned in period
- `totals.valueAtStart` - value at start of period
- `periodDays` - number of days in period (already returned by API)

### All-time fallback tooltip (lines 675-702)
From `yieldBreakdown`:
- `totalProtocolYieldUsd` - yield earned all-time
- `totalCostBasisHistorical` - cost basis (value deposited)
- `actualPeriodDays` - days since first deposit (already calculated in component)

## Changes Required

**File:** `components/wallet-balance.tsx`

### 1. Add Realized APY to period-specific tooltip (after Total, before Value at Start)
Location: After line 658 (after the Total div)

```tsx
{periodYieldBreakdownAPI.periodDays > 0 && periodYieldBreakdownAPI.totals.valueAtStart > 0 && (
  <div className="border-t border-zinc-700 pt-1 flex justify-between gap-4">
    <span className="text-zinc-400">Realized APY:</span>
    <span className="text-zinc-300">
      {((periodYieldBreakdownAPI.totals.protocolYieldUsd / periodYieldBreakdownAPI.totals.valueAtStart) * (365 / periodYieldBreakdownAPI.periodDays) * 100).toFixed(2)}%
    </span>
  </div>
)}
<p className="text-[10px] text-zinc-500 pt-1">
  Over {periodYieldBreakdownAPI.periodDays} days
</p>
```

### 2. Add Realized APY to all-time fallback tooltip (after Total, before Cost Basis)
Location: After line 695 (after the Total div)

```tsx
{actualPeriodDays > 0 && yieldBreakdown.totalCostBasisHistorical > 0 && (
  <div className="border-t border-zinc-700 pt-1 flex justify-between gap-4">
    <span className="text-zinc-400">Realized APY:</span>
    <span className="text-zinc-300">
      {((yieldBreakdown.totalProtocolYieldUsd / yieldBreakdown.totalCostBasisHistorical) * (365 / actualPeriodDays) * 100).toFixed(2)}%
    </span>
  </div>
)}
<p className="text-[10px] text-zinc-500 pt-1">
  Over {actualPeriodDays} days
</p>
```

## Example Output
- Period (1M): "Realized APY: 13.90%" + "Over 30 days"
- All Time: "Realized APY: 13.90%" + "Over 54 days"

## Notes
- Guard against division by zero with conditional rendering
- `periodDays` from API is already available in hook (line 186)
- `actualPeriodDays` already exists and is used in fallback tooltip
- The "Over X days" text exists in fallback but needs adding to period-specific tooltip
