"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { StrKey } from "@stellar/stellar-sdk"
import { useWalletContext, WalletContextValue } from "@/contexts/wallet-context"
import type { Wallet } from "@/types/wallet"

function isValidStellarAddress(addr: string): boolean {
  if (!addr || typeof addr !== "string") return false
  try {
    const trimmed = addr.trim()
    return StrKey.isValidEd25519PublicKey(trimmed) || StrKey.isValidContract(trimmed)
  } catch {
    return false
  }
}

export interface UseWalletStateReturn {
  wallets: Wallet[]
  activeWallet: Wallet | null
  activeWalletId: string | null
  isHydrated: boolean
  handleSelectWallet: (walletId: string) => void
  handleConnectWallet: (address: string, walletName?: string) => void
  handleDisconnect: (walletId: string) => void
}

export function useWalletState(): UseWalletStateReturn {
  const searchParams = useSearchParams()
  const {
    wallets,
    activeWallet,
    activeWalletId,
    isHydrated,
    setWallets,
    setActiveWalletId,
    handleSelectWallet,
    handleConnectWallet,
    handleDisconnect,
  } = useWalletContext()

  const [urlAddressProcessed, setUrlAddressProcessed] = useState(false)

  // Handle URL address parameter - add to followed list and show automatically
  useEffect(() => {
    if (!isHydrated || urlAddressProcessed) return

    const addressParam = searchParams.get("address")
    if (!addressParam) {
      setUrlAddressProcessed(true)
      return
    }

    const trimmedAddress = addressParam.trim()
    if (!isValidStellarAddress(trimmedAddress)) {
      console.warn("Invalid address in URL parameter:", trimmedAddress)
      setUrlAddressProcessed(true)
      return
    }

    // Check if this address already exists in wallets
    const existingWallet = wallets.find(
      (w) => w.publicKey.toLowerCase() === trimmedAddress.toLowerCase()
    )

    if (existingWallet) {
      // Address already exists, just select it
      setActiveWalletId(existingWallet.id)
      setWallets((prev) =>
        prev.map((w) => ({ ...w, isActive: w.id === existingWallet.id }))
      )
    } else {
      // Add as a new watched wallet
      const isContract = trimmedAddress.startsWith("C")
      const shortAddr = `${trimmedAddress.slice(0, 4)}...${trimmedAddress.slice(-4)}`
      const walletName = isContract ? `Contract ${shortAddr}` : `Watch ${shortAddr}`

      const newWallet: Wallet = {
        id: `wallet-${Date.now()}`,
        publicKey: trimmedAddress,
        name: walletName,
        isActive: true,
      }

      setWallets((prev) => {
        const updated = prev.map((w) => ({ ...w, isActive: false }))
        return [...updated, newWallet]
      })
      setActiveWalletId(newWallet.id)
    }

    setUrlAddressProcessed(true)
  }, [isHydrated, urlAddressProcessed, searchParams, wallets, setWallets, setActiveWalletId])

  return {
    wallets,
    activeWallet,
    activeWalletId,
    isHydrated,
    handleSelectWallet,
    handleConnectWallet,
    handleDisconnect,
  }
}
