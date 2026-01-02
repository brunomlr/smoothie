"use client"

import * as React from "react"
import { WALLETS_STORAGE_KEY, ACTIVE_WALLET_STORAGE_KEY } from "@/lib/constants"
import type { Wallet } from "@/types/wallet"

export interface WalletContextValue {
  wallets: Wallet[]
  activeWallet: Wallet | null
  activeWalletId: string | null
  isHydrated: boolean
  setWallets: React.Dispatch<React.SetStateAction<Wallet[]>>
  setActiveWalletId: React.Dispatch<React.SetStateAction<string | null>>
  handleSelectWallet: (walletId: string) => void
  handleConnectWallet: (address: string, walletName?: string) => void
  handleDisconnect: (walletId: string) => void
}

const WalletContext = React.createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = React.useState<Wallet[]>([])
  const [activeWalletId, setActiveWalletId] = React.useState<string | null>(null)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // Load wallets from localStorage on mount
  React.useEffect(() => {
    try {
      const savedWallets = localStorage.getItem(WALLETS_STORAGE_KEY)
      const savedActiveId = localStorage.getItem(ACTIVE_WALLET_STORAGE_KEY)

      if (savedWallets) {
        const parsedWallets = JSON.parse(savedWallets) as Wallet[]
        setWallets(parsedWallets)
      }

      if (savedActiveId) {
        setActiveWalletId(savedActiveId)
      }
    } catch (error) {
      console.error("Error loading wallets from localStorage:", error)
    } finally {
      setIsHydrated(true)
    }
  }, [])

  // Save wallets to localStorage whenever they change (only after hydration)
  React.useEffect(() => {
    if (!isHydrated) return

    try {
      if (wallets.length > 0) {
        localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(wallets))
      } else {
        localStorage.removeItem(WALLETS_STORAGE_KEY)
      }
    } catch (error) {
      console.error("Error saving wallets to localStorage:", error)
    }
  }, [wallets, isHydrated])

  // Save active wallet ID to localStorage whenever it changes (only after hydration)
  React.useEffect(() => {
    if (!isHydrated) return

    try {
      if (activeWalletId) {
        localStorage.setItem(ACTIVE_WALLET_STORAGE_KEY, activeWalletId)
      } else {
        localStorage.removeItem(ACTIVE_WALLET_STORAGE_KEY)
      }
    } catch (error) {
      console.error("Error saving active wallet ID to localStorage:", error)
    }
  }, [activeWalletId, isHydrated])

  const activeWallet = React.useMemo(
    () => wallets.find((w) => w.id === activeWalletId) ?? null,
    [wallets, activeWalletId]
  )

  const handleSelectWallet = React.useCallback((walletId: string) => {
    setActiveWalletId(walletId)
    setWallets((prev) =>
      prev.map((w) => ({ ...w, isActive: w.id === walletId }))
    )
  }, [])

  const handleConnectWallet = React.useCallback((address: string, walletName?: string) => {
    const newWallet: Wallet = {
      id: `wallet-${Date.now()}`,
      publicKey: address,
      name: walletName,
      isActive: true,
    }

    setWallets((prev) => {
      const updated = prev.map((w) => ({ ...w, isActive: false }))
      return [...updated, newWallet]
    })

    setActiveWalletId(newWallet.id)
  }, [])

  const handleDisconnect = React.useCallback((walletId: string) => {
    setWallets((prev) => {
      const remaining = prev.filter((w) => w.id !== walletId)

      // If we're disconnecting the active wallet, select the first remaining one
      if (activeWalletId === walletId && remaining.length > 0) {
        setActiveWalletId(remaining[0].id)
        return remaining.map((w, idx) => ({ ...w, isActive: idx === 0 }))
      } else if (activeWalletId === walletId) {
        setActiveWalletId(null)
      }

      return remaining
    })
  }, [activeWalletId])

  const value = React.useMemo(
    () => ({
      wallets,
      activeWallet,
      activeWalletId,
      isHydrated,
      setWallets,
      setActiveWalletId,
      handleSelectWallet,
      handleConnectWallet,
      handleDisconnect,
    }),
    [
      wallets,
      activeWallet,
      activeWalletId,
      isHydrated,
      handleSelectWallet,
      handleConnectWallet,
      handleDisconnect,
    ]
  )

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext(): WalletContextValue {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error("useWalletContext must be used within a WalletProvider")
  }
  return context
}
