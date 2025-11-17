"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchWalletBlendSnapshot, type BlendWalletSnapshot } from "@/lib/blend/positions"
import type { BalanceData } from "@/types/wallet-balance"
import type { AssetCardData } from "@/types/asset-card"

const usdFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00"
  }
  return usdFormatter.format(value)
}

function formatUsdWithDecimals(value: number, decimals = 7): string {
  if (!Number.isFinite(value)) {
    return "$0.00"
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

const ASSET_LOGO_MAP: Record<string, string> = {
  USDC: "/usdc-logo.svg",
  USDT: "/usdc-logo.svg",
  XLM: "/yxlm-logo.svg",
  AQUA: "/aqua-logo.svg",
  BLND: "/globe.svg",
}

function resolveAssetLogo(symbol: string | undefined): string {
  if (!symbol) {
    return "/globe.svg"
  }
  const normalized = symbol.toUpperCase()
  return ASSET_LOGO_MAP[normalized] ?? "/globe.svg"
}

function buildBalanceData(snapshot: BlendWalletSnapshot | undefined): BalanceData {
  if (!snapshot) {
    return {
      balance: "0.00",
      rawBalance: 0,
      apyPercentage: 0,
      interestEarned: "0.00",
      annualYield: "0.00",
      growthPercentage: 0,
    }
  }

  // Calculate raw balance using native token amounts (same as root app)
  const totalSupplyRaw = snapshot.positions.reduce(
    (acc, position) => acc + position.supplyAmount,
    0
  )

  const totalSupplyUsd = snapshot.positions.reduce(
    (acc, position) => acc + position.supplyUsdValue,
    0
  )
  const weightedSupplyApy = snapshot.weightedSupplyApy ?? 0
  const estimatedAnnualYield = (totalSupplyUsd * weightedSupplyApy) / 100

  return {
    balance: formatUsdWithDecimals(totalSupplyUsd),
    rawBalance: totalSupplyRaw, // Raw native token amount, not USD
    apyPercentage: Number.isFinite(weightedSupplyApy) ? weightedSupplyApy : 0,
    interestEarned: "0.00",
    annualYield: formatUsd(estimatedAnnualYield),
    growthPercentage: snapshot.weightedBlndApy ?? 0,
  }
}

function buildAssetCards(snapshot: BlendWalletSnapshot | undefined): AssetCardData[] {
  if (!snapshot) return []

  return snapshot.positions
    .filter((position) => position.supplyAmount > 0)
    .map<AssetCardData>((position) => ({
      id: position.id,
      protocolName: position.poolName || "Blend",
      assetName: position.symbol,
      logoUrl: resolveAssetLogo(position.symbol),
      balance: formatUsdWithDecimals(position.supplyUsdValue),
      rawBalance: position.supplyAmount, // Raw native token amount, not USD
      apyPercentage: position.supplyApy,
      growthPercentage: position.blndApy,
      earnedYield: 0, // Will be populated from balance history in the future
    }))
}

export function useBlendPositions(walletPublicKey: string | undefined) {
  const query = useQuery({
    queryKey: ["blend-wallet-snapshot", walletPublicKey],
    enabled: !!walletPublicKey,
    queryFn: () => fetchWalletBlendSnapshot(walletPublicKey),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const balanceData = useMemo(() => buildBalanceData(query.data), [query.data])
  const assetCards = useMemo(() => buildAssetCards(query.data), [query.data])

  const totalEmissions = useMemo(
    () => query.data?.totalEmissions ?? 0,
    [query.data]
  );

  return {
    ...query,
    balanceData,
    assetCards,
    totalEmissions,
  }
}
