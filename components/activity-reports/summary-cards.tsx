"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { YearSummary } from "@/lib/reports/types"
import { gainLossClass, signedCurrency } from "./helpers"

interface SummaryCardsProps {
  summary: YearSummary
  formatCurrency: (usd: number) => string
}

export function SummaryCards({ summary, formatCurrency }: SummaryCardsProps) {
  const realizedGainLoss =
    summary.disposalGainLossUsd - summary.lossEventsUsd + summary.reimbursementsUsd

  const hasTermSplit =
    summary.shortTermGainLossUsd !== 0 || summary.longTermGainLossUsd !== 0

  const cards = [
    {
      label: "Income received",
      value: summary.incomeUsd,
      detail: "Interest and emissions at value when received",
      neutral: true,
    },
    {
      label: "Realized gains / losses",
      value: realizedGainLoss,
      detail: hasTermSplit
        ? `Short-term ${signedCurrency(summary.shortTermGainLossUsd, formatCurrency)} · Long-term ${signedCurrency(summary.longTermGainLossUsd, formatCurrency)}`
        : summary.reimbursementsUsd > 0
          ? "Disposals, loss events and reimbursements"
          : "Disposals, liquidations and loss events",
      neutral: false,
    },
    {
      label: "Interest paid",
      value: summary.interestPaidUsd,
      detail: "Interest portion of loan repayments",
      neutral: true,
    },
    {
      label: "Net",
      value: summary.netUsd,
      detail: "Income plus realized gains and losses",
      neutral: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="py-3">
          <CardContent className="px-4 py-0">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                card.neutral ? "" : gainLossClass(card.value)
              }`}
            >
              {signedCurrency(card.value, formatCurrency)}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
