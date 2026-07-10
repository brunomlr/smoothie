"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { DisposalRow, LossEventRow, ReimbursementRow } from "@/lib/reports/types"
import {
  EmptySection,
  formatDay,
  formatQuantity,
  gainLossClass,
  PriceSourceFlag,
  SectionCard,
  ShowAllRows,
  signedCurrency,
  TxLink,
  useRowLimit,
} from "./helpers"

const KIND_LABELS: Record<DisposalRow["kind"], string> = {
  lp_withdrawal: "LP withdrawal",
  liquidation_collateral: "Liquidation",
}

interface DisposalsTableProps {
  disposals: DisposalRow[]
  lossEvents: LossEventRow[]
  reimbursements: ReimbursementRow[]
  formatCurrency: (usd: number) => string
  isDemoWallet?: boolean
}

/** Disposals, liquidations, bad-debt loss events and reimbursements, merged chronologically */
export function DisposalsTable({ disposals, lossEvents, reimbursements, formatCurrency, isDemoWallet }: DisposalsTableProps) {
  type MergedRow =
    | { type: "disposal"; date: string; row: DisposalRow }
    | { type: "loss"; date: string; row: LossEventRow }
    | { type: "reimbursement"; date: string; row: ReimbursementRow }

  const rows: MergedRow[] = [
    ...disposals.map((row) => ({ type: "disposal" as const, date: row.date, row })),
    ...lossEvents.map((row) => ({ type: "loss" as const, date: row.date, row })),
    ...reimbursements.map((row) => ({ type: "reimbursement" as const, date: row.date, row })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const { visible, hiddenCount, expand } = useRowLimit(rows)

  return (
    <SectionCard
      title="Gains & losses"
      subtitle="Disposals with cost basis and holding period, plus loss events and reimbursements"
    >
      {rows.length === 0 ? (
        <EmptySection message="No disposals or loss events this year" />
      ) : (
        <>
          {/* Mobile */}
          <div className="md:hidden">
            {visible.map((merged, i) => {
              if (merged.type === "reimbursement") {
                const row = merged.row
                return (
                  <div key={`reimb-${row.txHash}-${i}`} className="py-3 px-4 border-b border-border/50 last:border-b-0 bg-emerald-500/5">
                    <div className="flex justify-between items-center">
                      <Badge variant="outline" className="text-xs text-positive border-emerald-400/40">
                        Reimbursement
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDay(row.date)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm">
                        {formatQuantity(row.quantity)} {row.asset}
                      </span>
                      <span className="text-sm font-medium tabular-nums text-positive">
                        +{formatCurrency(row.valueUsd)}
                        <PriceSourceFlag source={row.priceSource} />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {row.label} — offsets the incident loss events
                    </p>
                  </div>
                )
              }
              if (merged.type === "loss") {
                const row = merged.row
                return (
                  <div key={`loss-${row.txHash}-${i}`} className="py-3 px-4 border-b border-border/50 last:border-b-0 bg-amber-500/5">
                    <div className="flex justify-between items-center">
                      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                        Loss event
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDay(row.date)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm">
                        {formatQuantity(row.lossTokens)} {row.asset}
                        <span className="text-xs text-muted-foreground ml-1">{row.poolName || ""}</span>
                      </span>
                      <span className="text-sm font-medium tabular-nums text-negative">
                        -{formatCurrency(row.lossUsd)}
                        <PriceSourceFlag source={row.priceSource} />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Withdrawal returned fewer tokens than deposited (bad-debt socialization)
                    </p>
                  </div>
                )
              }
              const row = merged.row
              return (
                <div key={`disp-${row.txHash}-${i}`} className="py-3 px-4 border-b border-border/50 last:border-b-0">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {KIND_LABELS[row.kind]}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {row.holdingPeriod === "long" ? "Long" : "Short"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDay(row.date)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm">
                      {formatQuantity(row.quantity)} {row.asset}
                    </span>
                    <span className={`text-sm font-medium tabular-nums ${gainLossClass(row.gainLossUsd)}`}>
                      {signedCurrency(row.gainLossUsd, formatCurrency)}
                      <PriceSourceFlag source={row.priceSource} />
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Acquired {row.dateAcquired === "VARIOUS" ? "on various dates" : formatDay(row.dateAcquired)} ·
                    proceeds {formatCurrency(row.proceedsUsd)} · basis {formatCurrency(row.costBasisUsd)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Proceeds / basis</TableHead>
                  <TableHead className="text-right">Gain / loss</TableHead>
                  <TableHead className="text-right pr-4">Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((merged, i) => {
                  if (merged.type === "reimbursement") {
                    const row = merged.row
                    return (
                      <TableRow key={`reimb-${row.txHash}-${i}`} className="hover:bg-transparent border-b border-border/50 last:border-b-0 bg-emerald-500/5">
                        <TableCell className="pl-4 text-sm">{formatDay(row.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs text-positive border-emerald-400/40">
                            Reimbursement
                          </Badge>
                          <div
                            className="text-xs text-muted-foreground mt-0.5 max-w-[170px] truncate"
                            title={`${row.label} — offsets the incident loss events`}
                          >
                            {row.label}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm tabular-nums">{formatQuantity(row.quantity)}</div>
                          <div className="text-xs text-muted-foreground">{row.asset}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums text-positive">
                          +{formatCurrency(row.valueUsd)}
                          <PriceSourceFlag source={row.priceSource} />
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <TxLink txHash={row.txHash} isDemoWallet={isDemoWallet} />
                        </TableCell>
                      </TableRow>
                    )
                  }
                  if (merged.type === "loss") {
                    const row = merged.row
                    return (
                      <TableRow key={`loss-${row.txHash}-${i}`} className="hover:bg-transparent border-b border-border/50 last:border-b-0 bg-amber-500/5">
                        <TableCell className="pl-4 text-sm">{formatDay(row.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                            Loss event
                          </Badge>
                          <div
                            className="text-xs text-muted-foreground mt-0.5 max-w-[170px] truncate"
                            title={`${row.poolName || "—"} · bad-debt socialization`}
                          >
                            {row.poolName || "—"} · bad-debt socialization
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm tabular-nums">{formatQuantity(row.lossTokens)}</div>
                          <div className="text-xs text-muted-foreground">{row.asset}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm tabular-nums">
                            {formatCurrency(row.receivedTokens * row.priceUsd)}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            basis {formatCurrency(row.principalTokens * row.priceUsd)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums text-negative">
                          -{formatCurrency(row.lossUsd)}
                          <PriceSourceFlag source={row.priceSource} />
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <TxLink txHash={row.txHash} isDemoWallet={isDemoWallet} />
                        </TableCell>
                      </TableRow>
                    )
                  }
                  const row = merged.row
                  return (
                    <TableRow key={`disp-${row.txHash}-${i}`} className="hover:bg-transparent border-b border-border/50 last:border-b-0">
                      <TableCell className="pl-4 text-sm">{formatDay(row.date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {KIND_LABELS[row.kind]}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {row.holdingPeriod === "long" ? "Long" : "Short"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[170px] truncate">
                          Acquired {row.dateAcquired === "VARIOUS" ? "on various dates" : formatDay(row.dateAcquired)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm tabular-nums">{formatQuantity(row.quantity)}</div>
                        <div className="text-xs text-muted-foreground">{row.asset}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm tabular-nums">{formatCurrency(row.proceedsUsd)}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          basis {formatCurrency(row.costBasisUsd)}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium tabular-nums ${gainLossClass(row.gainLossUsd)}`}>
                        {signedCurrency(row.gainLossUsd, formatCurrency)}
                        <PriceSourceFlag source={row.priceSource} />
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <TxLink txHash={row.txHash} isDemoWallet={isDemoWallet} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <ShowAllRows hiddenCount={hiddenCount} onExpand={expand} />
        </>
      )}
    </SectionCard>
  )
}
