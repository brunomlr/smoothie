import type { FormatCurrencyOptions } from "@/lib/currency/format"
import type { YieldChartDatum, PriceChartDatum } from "./transforms"

export function YieldTooltip({
  active,
  payload,
  formatCurrency,
}: {
  active?: boolean
  payload?: Array<{ payload: YieldChartDatum }>
  formatCurrency: (amount: number, options?: FormatCurrencyOptions) => string
}) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const data = payload[0].payload
  const formatValue = (value: number) =>
    formatCurrency(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      showSign: true,
    })

  const hasAnyValue =
    data.supplyApy !== 0 ||
    data.supplyBlndApy !== 0 ||
    data.backstopYield !== 0 ||
    data.backstopBlndApy !== 0 ||
    data.borrowInterestCost !== 0 ||
    data.borrowBlndApy !== 0

  return (
    <div className="bg-black text-white border border-zinc-800 rounded-md shadow-lg p-2.5 min-w-[160px] max-w-[220px] select-none z-50">
      <div className="font-medium text-[11px] mb-1.5 flex items-center gap-2">
        {data.period}
        {data.isLive && (
          <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
            Live
          </span>
        )}
      </div>

      {!hasAnyValue ? (
        <div className="text-[11px] text-zinc-400">No yield in this period</div>
      ) : (
        <div className="space-y-1 text-[11px]">
          {data.supplyApy !== 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-blue-500" />
                <span className="text-zinc-400">Supply APY</span>
              </div>
              <span className="tabular-nums text-blue-400">
                {formatValue(data.supplyApy)}
              </span>
            </div>
          )}

          {data.supplyBlndApy !== 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-sky-500" />
                <span className="text-zinc-400">Supply BLND</span>
              </div>
              <span className="tabular-nums text-sky-400">
                {formatValue(data.supplyBlndApy)}
              </span>
            </div>
          )}

          {data.backstopYield !== 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-sm ${data.backstopYield >= 0 ? "bg-violet-500" : "bg-red-500"}`} />
                <span className="text-zinc-400">Backstop Yield</span>
              </div>
              <span className={`tabular-nums ${data.backstopYield >= 0 ? "text-violet-400" : "text-red-400"}`}>
                {formatValue(data.backstopYield)}
              </span>
            </div>
          )}

          {data.backstopBlndApy !== 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-purple-400" />
                <span className="text-zinc-400">Backstop BLND</span>
              </div>
              <span className="tabular-nums text-purple-400">
                {formatValue(data.backstopBlndApy)}
              </span>
            </div>
          )}

          {data.borrowInterestCost !== 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-orange-500" />
                <span className="text-zinc-400">Borrow Cost</span>
              </div>
              <span className="tabular-nums text-orange-400">
                {formatValue(data.borrowInterestCost)}
              </span>
            </div>
          )}

          {data.borrowBlndApy !== 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-amber-500" />
                <span className="text-zinc-400">Borrow BLND</span>
              </div>
              <span className="tabular-nums text-amber-400">
                {formatValue(data.borrowBlndApy)}
              </span>
            </div>
          )}

          <div className="pt-1.5 mt-1.5 border-t border-zinc-700 flex justify-between items-center">
            <span className="text-zinc-300 font-medium">Total Yield</span>
            <span
              className={`tabular-nums font-medium ${
                data.yieldTotal >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatValue(data.yieldTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function PriceChangeTooltip({
  active,
  payload,
  formatCurrency,
}: {
  active?: boolean
  payload?: Array<{ payload: PriceChartDatum }>
  formatCurrency: (amount: number, options?: FormatCurrencyOptions) => string
}) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const data = payload[0].payload
  const formatValue = (value: number) =>
    formatCurrency(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      showSign: true,
    })

  return (
    <div className="bg-black text-white border border-zinc-800 rounded-md shadow-lg p-2.5 min-w-[140px] select-none z-50">
      <div className="font-medium text-[11px] mb-1.5 flex items-center gap-2">
        {data.period}
        {data.isLive && (
          <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
            Live
          </span>
        )}
      </div>

      <div className="flex justify-between items-center text-[11px]">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-sm ${
              data.priceChange >= 0 ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="text-zinc-400">Price Change</span>
        </div>
        <span
          className={`tabular-nums font-medium ${
            data.priceChange >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {formatValue(data.priceChange)}
        </span>
      </div>
    </div>
  )
}
