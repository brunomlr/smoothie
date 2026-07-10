"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { History, WalletCards, FileText } from "lucide-react"
import { TransactionHistory } from "@/components/transaction-history"
import { WalletActivityHistory } from "@/components/wallet-activity"
import { GainsLossesTab } from "@/components/activity-reports"
import { PageTitle } from "@/components/page-title"
import { useWalletState } from "@/hooks/use-wallet-state"
import { useAnalytics } from "@/hooks/use-analytics"
import { AuthenticatedPage } from "@/components/authenticated-page"
import { PageLoadingShell } from "@/components/page-loading-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

function HistoryContent() {
  const queryClient = useQueryClient()
  const { capture } = useAnalytics()
  const { activeWallet } = useWalletState()
  const [activeTab, setActiveTab] = useState("blend")

  // Track page view
  useEffect(() => {
    capture('page_viewed', { page: 'activity' })
  }, [capture])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    capture('tab_changed', { tab: value, page: 'activity' })
  }

  const handleRefresh = useCallback(async () => {
    if (!activeWallet?.publicKey) return

    capture('pull_to_refresh', { page: 'activity' })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["user-actions", activeWallet.publicKey] }),
      queryClient.invalidateQueries({ queryKey: ["wallet-operations", activeWallet.publicKey] }),
      queryClient.invalidateQueries({ queryKey: ["historical-prices"] }),
      queryClient.invalidateQueries({ queryKey: ["gains-losses-report", activeWallet.publicKey] }),
      queryClient.invalidateQueries({ queryKey: ["wallet-transfers-report", activeWallet.publicKey] }),
    ])
  }, [activeWallet, queryClient, capture])

  // Guard against null activeWallet during static generation
  // AuthenticatedPage will show the landing page if no wallet is connected
  if (!activeWallet) {
    return <AuthenticatedPage><div /></AuthenticatedPage>
  }

  return (
    <AuthenticatedPage onRefresh={handleRefresh}>
      <div>
        <PageTitle>Activity</PageTitle>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 h-10 sm:h-11 mb-6 bg-transparent border border-gray-500/20 rounded-lg">
            <TabsTrigger value="blend" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Blend Activity</span>
              <span className="sm:hidden">Blend</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="gap-1.5 text-xs sm:text-sm">
              <WalletCards className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Wallet Activity</span>
              <span className="sm:hidden">Wallet</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Gains & Losses</span>
              <span className="sm:hidden">Gains</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blend">
            <TransactionHistory
              publicKey={activeWallet.publicKey}
              limit={50}
              showControls={true}
              isDemoWallet={activeWallet.isDemoWallet}
            />
          </TabsContent>

          <TabsContent value="wallet">
            <WalletActivityHistory
              publicKey={activeWallet.publicKey}
              limit={50}
              isDemoWallet={activeWallet.isDemoWallet}
            />
          </TabsContent>

          <TabsContent value="reports">
            <GainsLossesTab
              publicKey={activeWallet.publicKey}
              isDemoWallet={activeWallet.isDemoWallet}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AuthenticatedPage>
  )
}

function HistoryLoading() {
  return (
    <PageLoadingShell>
      <div className="space-y-6">
        {/* Tabs and controls skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 sm:h-11 flex-1 rounded-lg" />
        </div>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>

        {/* Transaction list skeleton */}
        <Card className="py-0">
          <CardContent className="p-0">
            {/* Mobile view skeleton */}
            <div className="md:hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="py-3 px-4 space-y-3 border-b border-border/50 last:border-b-0">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <div className="text-right space-y-1">
                      <Skeleton className="h-4 w-24 ml-auto" />
                      <Skeleton className="h-3 w-16 ml-auto" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view skeleton */}
            <div className="hidden md:block">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center py-3 px-4 border-b border-border/50 last:border-b-0 gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16 mt-1" />
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-12 mt-1 ml-auto" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLoadingShell>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryLoading />}>
      <HistoryContent />
    </Suspense>
  )
}
