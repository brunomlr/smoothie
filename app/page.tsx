"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LandingPage } from "@/components/landing-page"
import { useWalletState } from "@/hooks/use-wallet-state"
import { useAnalytics } from "@/hooks/use-analytics"

export default function Landing() {
  const router = useRouter()
  const { capture } = useAnalytics()
  const {
    wallets,
    activeWallet,
    handleSelectWallet,
    handleConnectWallet,
    handleConnectDemoWallet,
    handleDisconnect,
    isHydrated,
  } = useWalletState()

  // Auto-redirect to /home if wallet is connected
  useEffect(() => {
    if (isHydrated && activeWallet) {
      router.replace('/home')
    }
  }, [isHydrated, activeWallet, router])

  // Track page view
  useEffect(() => {
    capture('page_viewed', { page: 'landing' })
  }, [capture])

  return (
    <LandingPage
      wallets={wallets}
      activeWallet={activeWallet}
      onSelectWallet={handleSelectWallet}
      onConnectWallet={handleConnectWallet}
      onConnectDemoWallet={handleConnectDemoWallet}
      onDisconnect={handleDisconnect}
      isHydrated={isHydrated}
    />
  )
}
