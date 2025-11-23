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
      rawInterestEarned: 0,
      annualYield: "0.00",
      growthPercentage: 0,
    }
  }

  const totalSupplyUsd = snapshot.positions.reduce(
    (acc, position) => acc + position.supplyUsdValue,
    0
  )
  const weightedSupplyApy = snapshot.weightedSupplyApy ?? 0
  const estimatedAnnualYield = (totalSupplyUsd * weightedSupplyApy) / 100

  return {
    balance: formatUsdWithDecimals(totalSupplyUsd),
    rawBalance: totalSupplyUsd, // USD value for yield calculation
    apyPercentage: Number.isFinite(weightedSupplyApy) ? weightedSupplyApy : 0,
    interestEarned: "0.00",
    rawInterestEarned: 0,
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
      rawBalance: position.supplyUsdValue, // USD value for yield calculation
      apyPercentage: position.supplyApy,
      growthPercentage: position.blndApy,
      earnedYield: 0, // Will be populated from page.tsx using: SDK balance - Dune cost basis
    }))
}

export function useBlendPositions(walletPublicKey: string | undefined, totalCostBasis?: number) {
  const query = useQuery({
    queryKey: ["blend-wallet-snapshot", walletPublicKey],
    enabled: !!walletPublicKey,
    queryFn: () => fetchWalletBlendSnapshot(walletPublicKey),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const balanceData = useMemo(() => {
    const data = buildBalanceData(query.data)

    // If we have cost basis from Dune, calculate real yield: SDK Balance - Cost Basis
    if (totalCostBasis !== undefined && totalCostBasis > 0) {
      const realYield = data.rawBalance - totalCostBasis
      const yieldPercentage = totalCostBasis > 0 ? (realYield / totalCostBasis) * 100 : 0

      return {
        ...data,
        interestEarned: formatUsd(realYield),
        rawInterestEarned: realYield,
        growthPercentage: yieldPercentage,
      }
    }

    return data
  }, [query.data, totalCostBasis])

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
