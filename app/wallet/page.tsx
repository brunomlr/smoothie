"use client"

import { useCallback, useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AuthenticatedPage } from "@/components/authenticated-page"
import { PageTitle } from "@/components/page-title"
import { WalletContent } from "@/components/wallet-content"
import { WalletAggregationSelector } from "@/components/wallet-aggregation-selector"
import { useWalletState } from "@/hooks/use-wallet-state"
import { useWalletContext } from "@/contexts/wallet-context"
import { useAnalytics } from "@/hooks/use-analytics"

const STORAGE_KEY = "wallet-page-selected-wallet-ids"

interface StoredSelection {
  activeWalletId?: string
  selectedIds?: string[]
}

function readStoredSelection(): { selectedIds: string[] | null; activeWalletId: string | null } {
  if (typeof window === "undefined") {
    return { selectedIds: null, activeWalletId: null }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { selectedIds: null, activeWalletId: null }
    }

    const parsed = JSON.parse(raw) as StoredSelection
    const selectedIds = Array.isArray(parsed.selectedIds) && parsed.selectedIds.length > 0
      ? parsed.selectedIds
      : null

    return {
      selectedIds,
      activeWalletId: parsed.activeWalletId ?? null,
    }
  } catch {
    return { selectedIds: null, activeWalletId: null }
  }
}

export default function WalletPage() {
  const queryClient = useQueryClient()
  const { activeWallet } = useWalletState()
  const { wallets } = useWalletContext()
  const { capture } = useAnalytics()
  const activeWalletId = activeWallet?.id ?? null

  // Track which wallets are selected for aggregation
  const [{ selectedIds: selectedWalletIds, activeWalletId: storedActiveWalletId }, setStoredSelection] = useState(readStoredSelection)

  // Derive effective selection.
  const effectiveSelectedWalletIds = useMemo(() => {
    if (!activeWalletId) {
      return []
    }

    if (storedActiveWalletId && storedActiveWalletId !== activeWalletId) {
      return [activeWalletId]
    }

    const validIds = (selectedWalletIds ?? []).filter((id) => wallets.some((w) => w.id === id))
    return validIds.length > 0 ? validIds : [activeWalletId]
  }, [selectedWalletIds, storedActiveWalletId, wallets, activeWalletId])

  const handleWalletSelectionApply = (walletIds: string[]) => {
    setStoredSelection({
      selectedIds: walletIds,
      activeWalletId: activeWalletId,
    })
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeWalletId: activeWalletId,
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
  }, [activeWallet, selectedWalletAddresses, queryClient, capture])

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
              activeWalletId={activeWalletId}
              selectedWalletIds={effectiveSelectedWalletIds}
              onApply={handleWalletSelectionApply}
            />
          ) : undefined
        }
      />
    </AuthenticatedPage>
  )
}
