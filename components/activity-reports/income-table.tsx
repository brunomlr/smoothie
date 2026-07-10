"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { IncomeRow, IncomeSource } from "@/lib/reports/types"
import { EmptySection, formatDay, formatQuantity, PriceSourceFlag, SectionCard, ShowAllRows, TxLink, useRowLimit } from "./helpers"

const SOURCE_LABELS: Record<IncomeSource, string> = {
  interest: "Interest",
  pool_emissions: "Emissions",
  backstop_emissions: "Backstop emissions",
}

interface IncomeTableProps {
  rows: IncomeRow[]
  bySource: Record<IncomeSource, number>
  totalUsd: number
  formatCurrency: (usd: number) => string
  isDemoWallet?: boolean
}

const SOURCE_ORDER: IncomeSource[] = ["interest", "pool_emissions", "backstop_emissions"]

export function IncomeTable({ rows, bySource, totalUsd, formatCurrency, isDemoWallet }: IncomeTableProps) {
  const { visible, hiddenCount, expand } = useRowLimit(rows)
  return (
    <SectionCard
      title="Income"
      subtitle="Tokens received as interest or emissions, valued when received"
    >
      {rows.length === 0 ? (
        <EmptySection message="No income this year" />
      ) : (
        <>
          {/* Mobile */}
          <div className="md:hidden">
            {visible.map((row, i) => (
              <div key={`${row.txHash}-${i}`} className="py-3 px-4 border-b border-border/50 last:border-b-0">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="text-xs">
                    {SOURCE_LABELS[row.source]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDay(row.date)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm">
                    {formatQuantity(row.quantity)} {row.asset}
                    <span className="text-xs text-muted-foreground ml-1">
                      {row.poolName || ""}
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(row.valueUsd)}
                    <PriceSourceFlag source={row.priceSource} />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right pr-4">Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row, i) => (
                  <TableRow key={`${row.txHash}-${i}`} className="hover:bg-transparent border-b border-border/50 last:border-b-0">
                    <TableCell className="pl-4 text-sm">{formatDay(row.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SOURCE_LABELS[row.source]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.poolName || "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatQuantity(row.quantity)} {row.asset}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {formatCurrency(row.valueUsd)}
                      <PriceSourceFlag source={row.priceSource} />
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <TxLink txHash={row.txHash} isDemoWallet={isDemoWallet} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ShowAllRows hiddenCount={hiddenCount} onExpand={expand} />

          {/* Per-source subtotals */}
          <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 py-2.5 px-4 border-t border-border/50 text-xs">
            {SOURCE_ORDER.filter((source) => bySource[source] > 0).map((source) => (
              <span key={source} className="text-muted-foreground tabular-nums">
                {SOURCE_LABELS[source]} {formatCurrency(bySource[source])}
              </span>
            ))}
            <span className="font-medium tabular-nums">Total {formatCurrency(totalUsd)}</span>
          </div>
        </>
      )}
    </SectionCard>
  )
}
