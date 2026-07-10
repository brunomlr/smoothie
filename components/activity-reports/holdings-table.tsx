"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { HoldingRow } from "@/lib/reports/types"
import { EmptySection, formatDay, formatQuantity, PriceSourceFlag, SectionCard } from "./helpers"

const TYPE_LABELS: Record<HoldingRow["type"], string> = {
  supply: "Supplied",
  debt: "Debt",
  backstop_lp: "Backstop LP",
}

interface HoldingsTableProps {
  rows: HoldingRow[]
  yearEndDate: string
  formatCurrency: (usd: number) => string
}

export function HoldingsTable({ rows, yearEndDate, formatCurrency }: HoldingsTableProps) {
  return (
    <SectionCard
      title="Holdings"
      subtitle={`Open positions as of ${formatDay(yearEndDate)}`}
    >
      {rows.length === 0 ? (
        <EmptySection message="No open positions at year end" />
      ) : (
        <>
          {/* Mobile */}
          <div className="md:hidden">
            {rows.map((row, i) => (
              <div key={`${row.poolId}-${row.asset}-${row.type}-${i}`} className="py-3 px-4 border-b border-border/50 last:border-b-0">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[row.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{row.poolName || ""}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(row.valueUsd)}
                    <PriceSourceFlag source={row.priceSource} />
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">
                    {formatQuantity(row.quantity)} {row.asset}
                  </span>
                  {row.costBasisUsd !== null && (
                    <span className="text-xs text-muted-foreground">
                      basis {formatCurrency(row.costBasisUsd)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Type</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right pr-4">Cost basis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={`${row.poolId}-${row.asset}-${row.type}-${i}`} className="hover:bg-transparent border-b border-border/50 last:border-b-0">
                    <TableCell className="pl-4">
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[row.type]}
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
                    <TableCell className="text-right pr-4 text-sm tabular-nums text-muted-foreground">
                      {row.costBasisUsd !== null ? formatCurrency(row.costBasisUsd) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </SectionCard>
  )
}
