"use client"

import { useState } from "react"
import { Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useWalletTransfersReport } from "@/hooks/use-gains-losses-report"
import { EmptySection, formatDay, formatQuantity, PriceSourceFlag, SectionCard, ShowAllRows, TxLink, useRowLimit } from "./helpers"

interface TransfersSectionProps {
  publicKey: string
  year: number | undefined
  formatCurrency: (usd: number) => string
  isDemoWallet?: boolean
}

/**
 * XLM/BLND wallet transfers (Horizon). Display-only: these are not part of
 * the gain/loss math — the user classifies them (income, purchase, self-transfer).
 * Loads independently so a slow Horizon fetch never blocks the on-chain report.
 */
export function TransfersSection({ publicKey, year, formatCurrency, isDemoWallet }: TransfersSectionProps) {
  // Collapsed by default; the Horizon fetch only starts once the section is first opened
  const [hasOpened, setHasOpened] = useState(false)
  const { data, isLoading, error } = useWalletTransfersReport(publicKey, year, hasOpened)
  const { visible, hiddenCount, expand } = useRowLimit(data?.transfers ?? [])

  return (
    <SectionCard
      title="Wallet transfers"
      subtitle="XLM and BLND payments in and out of this wallet — not included in the totals above"
      collapsible
      defaultOpen={false}
      onToggle={(open) => {
        if (open) setHasOpened(true)
      }}
    >
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <EmptySection message="Wallet transfers could not be loaded" />
      ) : !data || data.transfers.length === 0 ? (
        <EmptySection message="No XLM or BLND transfers this year" />
      ) : (
        <>
          {data.truncated && (
            <p className="text-xs text-amber-500 px-4 pt-3">
              This wallet has a very large history; the oldest transfers of the year may be missing.
            </p>
          )}

          {/* Mobile */}
          <div className="md:hidden">
            {visible.map((row, i) => (
              <div key={`${row.txHash}-${i}`} className="py-3 px-4 border-b border-border/50 last:border-b-0">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="text-xs">
                    {row.direction === "received" ? (
                      <ArrowDownLeft className="h-3 w-3 mr-1 text-positive" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3 mr-1 text-negative" />
                    )}
                    {row.direction === "received" ? "Received" : "Sent"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDay(row.date)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm">
                    {formatQuantity(row.quantity)} {row.asset}
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
                  <TableHead>Direction</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Est. value</TableHead>
                  <TableHead className="text-right pr-4">Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row, i) => (
                  <TableRow key={`${row.txHash}-${i}`} className="hover:bg-transparent border-b border-border/50 last:border-b-0">
                    <TableCell className="pl-4 text-sm">{formatDay(row.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.direction === "received" ? (
                          <ArrowDownLeft className="h-3 w-3 mr-1 text-positive" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3 mr-1 text-negative" />
                        )}
                        {row.direction === "received" ? "Received" : "Sent"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {!row.counterparty
                        ? "—"
                        : row.counterparty.length > 12
                          ? `${row.counterparty.slice(0, 6)}…${row.counterparty.slice(-4)}`
                          : row.counterparty}
                    </TableCell>
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
        </>
      )}
    </SectionCard>
  )
}
