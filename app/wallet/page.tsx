"use client"

import { useCallback, useState, useMemo, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AuthenticatedPage } from "@/components/authenticated-page"
import { PageTitle } from "@/components/page-title"
import { WalletContent } from "@/components/wallet-content"
import { WalletAggregationSelector } from "@/components/wallet-aggregation-selector"
import { useWalletState } from "@/hooks/use-wallet-state"
import { useWalletContext } from "@/contexts/wallet-context"
import { useAnalytics } from "@/hooks/use-analytics"

const STORAGE_KEY = "wallet-page-selected-wallet-ids"

export default function WalletPage() {
  const queryClient = useQueryClient()
  const { activeWallet } = useWalletState()
  const { wallets } = useWalletContext()
  const { capture } = useAnalytics()

  // Track which wallets are selected for aggregation
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[] | null>(null)

  // Load selection from localStorage on mount, reset if active wallet changed
  useEffect(() => {
    if (!activeWallet?.id || wallets.length === 0) return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Check if stored selection was for a different active wallet
        if (parsed.activeWalletId && parsed.activeWalletId !== activeWallet.id) {
          // Active wallet changed, reset to just the new active wallet
          setSelectedWalletIds([activeWallet.id])
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              activeWalletId: activeWallet.id,
              selectedIds: [activeWallet.id],
            })
          )
          return
        }
        // Load stored selection if valid
        if (Array.isArray(parsed.selectedIds) && parsed.selectedIds.length > 0) {
          const validIds = parsed.selectedIds.filter((id: string) =>
            wallets.some((w) => w.id === id)
          )
          if (validIds.length > 0) {
            setSelectedWalletIds(validIds)
            return
          }
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [wallets, activeWallet?.id])

  // Derive effective selection: if null (not yet set), default to just active wallet
  const effectiveSelectedWalletIds = useMemo(() => {
    if (selectedWalletIds === null && activeWallet?.id) {
      return [activeWallet.id]
    }
    return selectedWalletIds ?? []
  }, [selectedWalletIds, activeWallet?.id])

  const handleWalletSelectionApply = (walletIds: string[]) => {
    setSelectedWalletIds(walletIds)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeWalletId: activeWallet?.id,
        selectedIds: walletIds,
      })
    )
  }

  // Derive wallet addresses from selected wallet IDs
  const selectedWalletAddresses = useMemo(() => {
    return effectiveSelectedWalletIds
      .map((id) => {
        const wallet = wallets.find((w) => w.id === id)
        return wallet ? { walletId: id, publicKey: wallet.publicKey } : null
      })
      .filter((w): w is { walletId: string; publicKey: string } => w !== null)
  }, [effectiveSelectedWalletIds, wallets])

  // Determine if we're in multi-wallet mode
  const isMultiWallet = selectedWalletAddresses.length > 1

  const handleRefresh = useCallback(async () => {
    if (!activeWallet?.publicKey) return

    capture("pull_to_refresh", { page: "wallet" })

    // Invalidate queries for all selected wallets (both single and multi-wallet query keys)
    const invalidations = selectedWalletAddresses.flatMap(({ publicKey }) => [
      queryClient.invalidateQueries({ queryKey: ["horizonBalances", publicKey] }),
      queryClient.invalidateQueries({ queryKey: ["multiWalletBalances", publicKey] }),
    ])

    await Promise.all([
      ...invalidations,
      queryClient.invalidateQueries({ queryKey: ["tokenBalance"] }),
      queryClient.invalidateQueries({
        queryKey: ["blend-wallet-snapshot", activeWallet.publicKey],
      }),
      queryClient.invalidateQueries({ queryKey: ["token-sparkline"] }),
    ])
  }, [activeWallet?.publicKey, selectedWalletAddresses, queryClient, capture])

  return (
    <AuthenticatedPage onRefresh={handleRefresh}>
      <PageTitle>Wallet</PageTitle>
      <WalletContent
        selectedWalletAddresses={selectedWalletAddresses}
        wallets={wallets}
        isMultiWallet={isMultiWallet}
        walletSelector={
          wallets.length > 1 ? (
            <WalletAggregationSelector
              wallets={wallets}
              activeWalletId={activeWallet?.id ?? null}
              selectedWalletIds={effectiveSelectedWalletIds}
              onApply={handleWalletSelectionApply}
            />
          ) : undefined
        }
      />
    </AuthenticatedPage>
  )
}
