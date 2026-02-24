"use client"

import { useEffect, useState, useCallback } from "react"
import { Buffer } from "buffer"
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk"
import { Networks } from "@creit-tech/stellar-wallets-kit/types"
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils"
// WalletConnect is imported dynamically to avoid SSR issues with Node.js-only dependencies
import { LedgerModule } from "@creit-tech/stellar-wallets-kit/modules/ledger"
import { HotWalletModule } from "@creit-tech/stellar-wallets-kit/modules/hotwallet"

// Polyfill Buffer for browser (required by Ledger and HotWallet modules)
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer
}

// Wallet type from the SDK
export interface SupportedWallet {
  id: string
  name: string
  type: string
  isAvailable: boolean
  icon: string
  url: string
}

// Get network from environment variable
function getDefaultNetwork(): Networks {
  const networkEnv = process.env.NEXT_PUBLIC_STELLAR_NETWORK
  if (networkEnv === "public" || networkEnv === "mainnet") {
    return Networks.PUBLIC
  }
  return Networks.TESTNET
}

// Global initialization state
let isKitInitialized = false
let initializationPromise: Promise<void> | null = null

async function ensureInitialized(network: Networks): Promise<void> {
  // Only initialize on client side
  if (typeof window === "undefined") {
    throw new Error("Cannot initialize wallet kit on server side")
  }

  // Already initialized
  if (isKitInitialized) {
    return
  }

  // Initialization in progress - wait for it
  if (initializationPromise) {
    return initializationPromise
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      const modules = defaultModules()

      // Add Ledger module
      modules.push(new LedgerModule())

      // Add HotWallet module
      modules.push(new HotWalletModule())

      // Add WalletConnect module if project ID is available
      // Dynamic import to avoid SSR issues with Node.js-only dependencies
      const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
      if (wcProjectId) {
        const { WalletConnectModule, WalletConnectTargetChain } = await import(
          "@creit-tech/stellar-wallets-kit/modules/wallet-connect"
        )
        const walletConnectModule = new WalletConnectModule({
          projectId: wcProjectId,
          metadata: {
            name: "Smoothie",
            description: "Stellar Portfolio Manager",
            url: window.location.origin,
            icons: [`${window.location.origin}/icon.png`],
          },
          allowedChains: network === Networks.PUBLIC
            ? [WalletConnectTargetChain.PUBLIC]
            : [WalletConnectTargetChain.TESTNET],
        })
        modules.push(walletConnectModule)
      }

      StellarWalletsKit.init({
        network,
        modules,
      })
      StellarWalletsKit.setNetwork(network)
      isKitInitialized = true
    } catch (error) {
      console.error("Failed to initialize wallet kit:", error)
      initializationPromise = null
      throw error
    }
  })()

  return initializationPromise
}

export function useStellarWalletKit(network: Networks = getDefaultNetwork()) {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    ensureInitialized(network)
      .then(() => setIsInitialized(true))
      .catch(() => setIsInitialized(false))
  }, [network])

  const getSupportedWallets = useCallback(async (): Promise<SupportedWallet[]> => {
    await ensureInitialized(network)
    const wallets = await StellarWalletsKit.refreshSupportedWallets()
    // Sort available wallets first
    return wallets.sort((a: SupportedWallet, b: SupportedWallet) => {
      if (a.isAvailable === b.isAvailable) return 0
      return a.isAvailable ? -1 : 1
    })
  }, [network])

  const connectWallet = useCallback(async (walletId: string): Promise<string> => {
    await ensureInitialized(network)

    try {
      StellarWalletsKit.setWallet(walletId)
      // Access the selected module directly and request access
      const selectedModule = StellarWalletsKit.selectedModule
      if (!selectedModule) {
        throw new Error("Wallet module not found")
      }
      // For Ledger wallets, we need to provide a BIP44 path
      // Standard Stellar path is 44'/148'/0' (first account)
      const isLedger = walletId === "LEDGER"
      const { address } = await selectedModule.getAddress({
        skipRequestAccess: false,
        ...(isLedger && { path: "44'/148'/0'" }),
      })
      return address
    } catch (error: unknown) {
      // Extract error details - wallet errors often don't serialize well
      let errorMessage = "Failed to connect wallet"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as Record<string, unknown>
        errorMessage = errorObj.message as string || errorObj.code as string || JSON.stringify(error)
      }
      console.error("Failed to connect wallet:", errorMessage, error)
      throw new Error(errorMessage)
    }
  }, [network])

  const disconnect = useCallback(async (): Promise<void> => {
    if (!isKitInitialized) {
      return
    }
    try {
      await StellarWalletsKit.disconnect()
    } catch (error) {
      console.error("Failed to disconnect:", error)
    }
  }, [])

  const getAddress = useCallback(async (): Promise<string> => {
    await ensureInitialized(network)
    const { address } = await StellarWalletsKit.getAddress()
    return address
  }, [network])

  const openWalletModal = useCallback(async (
    onWalletSelected?: (address: string) => Promise<void> | void
  ): Promise<string | undefined> => {
    await ensureInitialized(network)

    try {
      const authModalOptions = {
        onWalletSelected: async (wallet: SupportedWallet) => {
          StellarWalletsKit.setWallet(wallet.id)
        },
      } as unknown as Parameters<typeof StellarWalletsKit.authModal>[0]
      const result = await StellarWalletsKit.authModal(authModalOptions)

      if (onWalletSelected && result.address) {
        await onWalletSelected(result.address)
      }

      return result.address
    } catch (error) {
      console.error("Failed to open wallet modal:", error)
      throw error
    }
  }, [network])

  return {
    isInitialized,
    openWalletModal,
    getAddress,
    disconnect,
    getSupportedWallets,
    connectWallet,
  }
}
