"use client"

import { useEffect, useLayoutEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LandingPage } from "@/components/landing-page"
import { useWalletState } from "@/hooks/use-wallet-state"
import { useAnalytics } from "@/hooks/use-analytics"

export default function Landing() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const shouldStayOnLanding = searchParams.get("from") === "logo"
  const shouldRedirectToHome = isHydrated && !!activeWallet && !shouldStayOnLanding

  // Auto-redirect to /home if wallet is connected
  useLayoutEffect(() => {
    if (shouldRedirectToHome) {
      router.replace("/home")
    }
  }, [shouldRedirectToHome, router])

  // Track landing page view only when this page is actually shown
  useEffect(() => {
    if (isHydrated && (!activeWallet || shouldStayOnLanding)) {
      capture("page_viewed", { page: "landing" })
    }
  }, [capture, isHydrated, activeWallet, shouldStayOnLanding])

  // Avoid rendering landing UI before hydration or when redirecting to /home
  if (!isHydrated || shouldRedirectToHome) {
    return null
  }

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
