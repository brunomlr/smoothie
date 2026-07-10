"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { InterestPaidRow } from "@/lib/reports/types"
import { EmptySection, formatDay, formatQuantity, PriceSourceFlag, SectionCard, ShowAllRows, TxLink, useRowLimit } from "./helpers"

interface InterestPaidTableProps {
  rows: InterestPaidRow[]
  formatCurrency: (usd: number) => string
  isDemoWallet?: boolean
}

export function InterestPaidTable({ rows, formatCurrency, isDemoWallet }: InterestPaidTableProps) {
  const { visible, hiddenCount, expand } = useRowLimit(rows)
  if (rows.length === 0) return null

  return (
    <SectionCard
      title="Interest paid"
      subtitle="Interest portion of loan repayments, valued when repaid"
    >
      {rows.length === 0 ? (
        <EmptySection message="No interest paid this year" />
      ) : (
        <>
          {/* Mobile */}
          <div className="md:hidden">
            {visible.map((row, i) => (
              <div key={`${row.txHash}-${i}`} className="py-3 px-4 border-b border-border/50 last:border-b-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm">
                    {formatQuantity(row.interestTokens)} {row.asset}
                    <span className="text-xs text-muted-foreground ml-1">{row.poolName || ""}</span>
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(row.interestUsd)}
                      <PriceSourceFlag source={row.priceSource} />
                    </span>
                    <p className="text-xs text-muted-foreground">{formatDay(row.date)}</p>
                  </div>
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
                  <TableHead>Pool</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right pr-4">Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row, i) => (
                  <TableRow key={`${row.txHash}-${i}`} className="hover:bg-transparent border-b border-border/50 last:border-b-0">
                    <TableCell className="pl-4 text-sm">{formatDay(row.date)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.poolName || "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatQuantity(row.interestTokens)} {row.asset}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {formatCurrency(row.interestUsd)}
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
        </>
      )}
    </SectionCard>
  )
}
