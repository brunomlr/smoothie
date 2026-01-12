"use client"

import { useRef, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody } from "@/components/ui/table"
import { useWalletOperations } from "@/hooks/use-wallet-operations"
import { OperationRow, MobileOperationCard } from "./operation-row"

interface WalletActivityHistoryProps {
  publicKey: string
  limit?: number
  isDemoWallet?: boolean
}

export function WalletActivityHistory({
  publicKey,
  limit = 50,
  isDemoWallet,
}: WalletActivityHistoryProps) {
  const mobileLoadMoreRef = useRef<HTMLDivElement>(null)
  const desktopLoadMoreRef = useRef<HTMLDivElement>(null)

  const { isLoading, isFetchingNextPage, error, operations, fetchNextPage, hasNextPage } =
    useWalletOperations({
      publicKey,
      limit,
      enabled: !!publicKey,
    })

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  )

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0,
    })

    if (mobileLoadMoreRef.current) {
      observer.observe(mobileLoadMoreRef.current)
    }
    if (desktopLoadMoreRef.current) {
      observer.observe(desktopLoadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [handleObserver])

  if (!publicKey) {
    return null
  }

  if (error) {
    return (
      <div className="text-sm text-destructive py-8 text-center">
        Error loading wallet activity: {error.message}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card className="py-0">
        <CardContent className="p-0">
          {/* Mobile view skeleton */}
          <div className="md:hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="py-3 px-4 space-y-3 border-b border-border/50 last:border-b-0">
                <div className="flex justify-between items-center">
                  <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
                  <div className="h-3 w-28 rounded bg-muted animate-pulse" />
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="text-right space-y-1">
                    <div className="h-4 w-24 rounded bg-muted animate-pulse ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view skeleton */}
          <div className="hidden md:block">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center py-3 px-4 border-b border-border/50 last:border-b-0 gap-4">
                <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted animate-pulse mt-1" />
                </div>
                <div className="text-right">
                  <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-12 rounded bg-muted animate-pulse mt-1 ml-auto" />
                </div>
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (operations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No wallet activity found
      </p>
    )
  }

  return (
    <Card className="py-0">
      <CardContent className="p-0">
        {/* Mobile Card View */}
        <div className="md:hidden">
          {operations.map((operation) => (
            <MobileOperationCard
              key={operation.id}
              operation={operation}
              currentUserAddress={publicKey}
              isDemoWallet={isDemoWallet}
            />
          ))}
          {/* Load more trigger */}
          <div ref={mobileLoadMoreRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableBody>
              {operations.map((operation) => (
                <OperationRow
                  key={operation.id}
                  operation={operation}
                  currentUserAddress={publicKey}
                  isDemoWallet={isDemoWallet}
                />
              ))}
            </TableBody>
          </Table>
          {/* Load more trigger */}
          <div ref={desktopLoadMoreRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
