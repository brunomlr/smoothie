"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"
import { useAnalytics } from "@/hooks/use-analytics"
import { useGainsLossesReport } from "@/hooks/use-gains-losses-report"
import { YIELDBLOX_INCIDENT_LINK } from "@/lib/config/blockchain"
import { SummaryCards } from "./summary-cards"
import { IncomeTable } from "./income-table"
import { DisposalsTable } from "./disposals-table"
import { InterestPaidTable } from "./interest-paid-table"
import { HoldingsTable } from "./holdings-table"
import { TransfersSection } from "./transfers-section"

interface GainsLossesTabProps {
  publicKey: string
  isDemoWallet?: boolean
}

const EXPORT_SECTIONS = [
  { value: "all", label: "Everything" },
  { value: "income", label: "Income only" },
  { value: "disposals", label: "Gains & losses only" },
  { value: "interest_paid", label: "Interest paid only" },
  { value: "holdings", label: "Holdings only" },
  { value: "transfers", label: "Wallet transfers only" },
]

export function GainsLossesTab({ publicKey, isDemoWallet }: GainsLossesTabProps) {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [isExporting, setIsExporting] = useState(false)
  const { format: formatCurrency } = useCurrencyPreference()
  const { capture } = useAnalytics()

  const { data, isLoading, isFetching, error, refetch } = useGainsLossesReport(publicKey, selectedYear)

  const report = data?.report ?? null
  const year = report?.year

  const handleExport = async (section: string) => {
    if (!year) return
    setIsExporting(true)
    capture("report_exported", { page: "activity", year, section })
    try {
      const params = new URLSearchParams({
        user: publicKey,
        year: String(year),
        section,
      })
      const response = await fetch(`/api/export/gains-losses?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || "Export failed")
      }
      const disposition = response.headers.get("Content-Disposition")
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || `gains-losses_${year}.csv`

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed:", err)
      toast.error(err instanceof Error ? err.message : "Export failed")
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return <GainsLossesSkeleton />
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-destructive">
          Error loading report: {error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!data || data.years.length === 0 || !report) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No activity found for this wallet yet
      </p>
    )
  }

  return (
    <div className={`space-y-6 ${isFetching ? "opacity-60" : ""}`}>
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Select
          value={String(year)}
          onValueChange={(value) => {
            setSelectedYear(parseInt(value, 10))
            capture("report_year_changed", { page: "activity", year: value })
          }}
        >
          <SelectTrigger className="h-8 w-[100px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...data.years].reverse().map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isExporting}
                  aria-label="Download CSV"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-black text-white border-black" arrowClassName="bg-black fill-black">
              Download CSV
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Export {year} as CSV</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {EXPORT_SECTIONS.map((section) => (
              <DropdownMenuItem key={section.value} onClick={() => handleExport(section.value)}>
                {section.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* YieldBlox incident banner — only for years whose report contains incident rows */}
      {data.yieldBloxExposure && (report.lossEvents.length > 0 || report.reimbursements.length > 0) && (
        <Card className="border-amber-500/40 bg-amber-500/5 py-2 gap-0">
          <CardContent className="py-0 text-sm text-amber-700 dark:text-amber-300">
            This wallet had exposure to the Yieldblox pool incident. Withdrawals affected by the
            bad-debt socialization appear below as loss events
            {report.reimbursements.length > 0
              ? ", and the remediation payment received appears as a reimbursement"
              : ""}
            .{" "}
            <a
              href={YIELDBLOX_INCIDENT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:opacity-80"
            >
              Learn more
            </a>
          </CardContent>
        </Card>
      )}

      <SummaryCards summary={report.summary} formatCurrency={formatCurrency} />

      <IncomeTable
        rows={report.income}
        bySource={report.summary.incomeBySource}
        totalUsd={report.summary.incomeUsd}
        formatCurrency={formatCurrency}
        isDemoWallet={isDemoWallet}
      />

      <DisposalsTable
        disposals={report.disposals}
        lossEvents={report.lossEvents}
        reimbursements={report.reimbursements}
        formatCurrency={formatCurrency}
        isDemoWallet={isDemoWallet}
      />

      <InterestPaidTable
        rows={report.interestPaid}
        formatCurrency={formatCurrency}
        isDemoWallet={isDemoWallet}
      />

      <TransfersSection
        publicKey={publicKey}
        year={year}
        formatCurrency={formatCurrency}
        isDemoWallet={isDemoWallet}
      />

      <HoldingsTable
        rows={report.yearEndHoldings}
        yearEndDate={report.yearEndDate}
        formatCurrency={formatCurrency}
      />

      {/* Footnotes */}
      <div className="text-xs text-muted-foreground space-y-1 px-1">
        {data.notes.map((note) => (
          <p key={note}>· {note}</p>
        ))}
        <p>
          · Values marked <span className="text-amber-500">*</span> have no historical price data for
          that date and may be inaccurate.
        </p>
        <p>
          · Cost basis uses first-in-first-out lots, tracked per wallet. Supplying and withdrawing
          the same asset is not treated as a disposal; the interest portion of each withdrawal is
          reported as income. Backstop LP tokens are treated as their own asset.
        </p>
        {report.reimbursements.length > 0 && (
          <p>
            · Reimbursements offset the incident loss events: a reimbursed loss generally cannot be
            claimed, and any amount received beyond the loss may itself be reportable.
          </p>
        )}
        <p>
          · Informational summary generated from on-chain events and daily price data. Verify
          against your own records.
        </p>
      </div>
    </div>
  )
}

function GainsLossesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Skeleton className="h-8 w-[100px] rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {[1, 2].map((section) => (
        <div key={section}>
          <Skeleton className="h-4 w-24 mb-2" />
          <Card className="py-0">
            <CardContent className="p-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-3 px-4 border-b border-border/50 last:border-b-0 flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
