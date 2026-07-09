/**
 * APY Simulation API Route
 *
 * Fetches reserve configuration data needed for APY simulation.
 * Returns reserve config, current state, and computed simulation results.
 */

import { NextRequest } from "next/server";
import {
  PoolV1,
  PoolV2,
  PoolMetadata,
  Backstop,
  TokenMetadata,
  FixedMath,
  Version,
} from "@blend-capital/blend-sdk";
import { getBlendNetwork } from "@/lib/blend/network";
import { metadataRepository } from "@/lib/db/repositories/metadata-repository";
import {
  simulateApyChange,
  type SimulationAction,
  type ReserveConfig,
} from "@/lib/blend/apy-simulator";
import { createApiHandler, requireString } from "@/lib/api";

interface ReserveConfigResponse {
  poolId: string;
  poolName: string;
  assetId: string;
  tokenSymbol: string;
  // Current state
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  supplyApy: number;
  borrowApy: number;
  // Reserve config for simulation
  reserveConfig: ReserveConfig;
  irModifier: number;
  backstopTakeRate: number;
  maxUtil: number;
  // For BLND emission calculation
  blndEmissionsPerYear: number | null;
  blndPrice: number | null;
  assetPrice: number | null;
}

function computeBlndPrice(backstop: Backstop | null): number | null {
  if (!backstop?.backstopToken) return null;

  try {
    const bt = backstop.backstopToken;
    const usdcAmount = FixedMath.toFloat(bt.usdc, 7);
    const blndAmount = FixedMath.toFloat(bt.blnd, 7);
    if (blndAmount > 0) {
      return (usdcAmount / 0.2) / (blndAmount / 0.8);
    }
  } catch {
    // Failed to compute BLND price
  }
  return null;
}

async function loadReserveConfig(
  poolId: string,
  assetId: string
): Promise<ReserveConfigResponse | null> {
  const network = getBlendNetwork();

  try {
    // Resolve the pool version: loading a V1 pool through the V2 class either
    // throws on emission parsing or misreads bRate/dRate (9 vs 12 decimals,
    // 1000x off) and the IR modifier (9 vs 7 decimals, 100x off)
    let version = Version.V2;
    try {
      const pools = await metadataRepository.getPools();
      const dbPool = pools.find((p) => p.pool_id === poolId);
      if (dbPool?.version === 1) {
        version = Version.V1;
      }
    } catch {
      // DB unavailable - default to V2
    }

    // Load pool and metadata
    const metadata = await PoolMetadata.load(network, poolId);
    const pool =
      version === Version.V1
        ? await PoolV1.loadWithMetadata(network, poolId, metadata)
        : await PoolV2.loadWithMetadata(network, poolId, metadata);

    // Get reserve
    const reserve = pool.reserves.get(assetId);
    if (!reserve) {
      return null;
    }

    // Get token symbol
    let tokenSymbol = assetId.slice(0, 4);
    try {
      const tokenMeta = await TokenMetadata.load(network, assetId);
      tokenSymbol = tokenMeta.symbol;
    } catch {
      // Use truncated address as fallback
    }

    // Load backstop for BLND price and take rate
    let backstop: Backstop | null = null;
    if (metadata.backstop) {
      try {
        backstop = await Backstop.load(network, metadata.backstop);
      } catch {
        // Backstop load failed
      }
    }

    const blndPrice = computeBlndPrice(backstop);

    // Extract reserve config
    const config = reserve.config;
    if (!config) {
      return null;
    }

    // Get IR modifier - convert from fixed point
    const irModDecimals = reserve.irmodDecimals || 9;
    const irModifier = reserve.data?.interestRateModifier
      ? Number(reserve.data.interestRateModifier) / Math.pow(10, irModDecimals)
      : 1;

    // Get backstop take rate from pool metadata (7 decimals)
    const backstopTakeRate = metadata.backstopRate
      ? Number(metadata.backstopRate) / 1e7
      : 0;

    // Calculate total supply and borrow
    const totalSupply = reserve.totalSupplyFloat();
    const totalBorrow = reserve.totalLiabilitiesFloat();
    const utilization = reserve.getUtilizationFloat();

    // Get current APYs
    const supplyApy = reserve.estSupplyApy * 100;
    const borrowApy = reserve.estBorrowApy * 100;

    // Calculate BLND emissions per year for this reserve
    let blndEmissionsPerYear: number | null = null;
    if (reserve.supplyEmissions) {
      try {
        const totalSupplyRaw = reserve.totalSupply();
        const decimals = config.decimals ?? 7;
        const emissionsPerToken = reserve.supplyEmissions.emissionsPerYearPerToken(
          totalSupplyRaw,
          decimals
        );
        // Total emissions = emissions per token * total supply (in tokens)
        blndEmissionsPerYear = emissionsPerToken * totalSupply;
      } catch {
        // Failed to calculate emissions
      }
    }

    // Fetch the asset price from the pool's oracle. The previous hardcoded $1
    // made the BLND emission APY wrong by the asset's actual price (e.g. ~3x
    // understated for XLM). If the oracle is unavailable, leave null so the
    // emission APY is omitted rather than wrong.
    let assetPrice: number | null = null;
    try {
      const oracle = await pool.loadOracle();
      const priceFloat = oracle.getPriceFloat(assetId);
      if (priceFloat != null && Number.isFinite(priceFloat) && priceFloat > 0) {
        assetPrice = priceFloat;
      }
    } catch {
      // Oracle load failed - emission APY will be omitted
    }

    // Convert config values from fixed point (7 decimals) to float
    const reserveConfig: ReserveConfig = {
      rBase: config.r_base / 1e7,
      rOne: config.r_one / 1e7,
      rTwo: config.r_two / 1e7,
      rThree: config.r_three / 1e7,
      targetUtil: config.util / 1e7,
      maxUtil: config.max_util / 1e7,
    };

    return {
      poolId,
      poolName: metadata.name,
      assetId,
      tokenSymbol,
      totalSupply,
      totalBorrow,
      utilization,
      supplyApy,
      borrowApy,
      reserveConfig,
      irModifier,
      backstopTakeRate,
      maxUtil: config.max_util / 1e7,
      blndEmissionsPerYear,
      blndPrice,
      assetPrice,
    };
  } catch (error) {
    console.error(`[Simulate APY API] Failed to load reserve config:`, error);
    return null;
  }
}

interface SimulateApyResponse {
  reserve: ReserveConfigResponse;
  simulation: ReturnType<typeof simulateApyChange> | null;
}

export const GET = createApiHandler<SimulateApyResponse>({
  logPrefix: "[Simulate APY API]",
  cache: { maxAge: 30, staleWhileRevalidate: 60 }, // Short cache since pool state changes frequently

  async handler(_request: NextRequest, { searchParams }) {
    const poolId = requireString(searchParams, "poolId");
    const assetId = requireString(searchParams, "assetId");

    // Optional simulation parameters
    const action = searchParams.get("action") as SimulationAction | null;
    const amountStr = searchParams.get("amount");
    const amount = amountStr ? parseFloat(amountStr) : null;

    // Load reserve configuration
    const reserveData = await loadReserveConfig(poolId, assetId);

    if (!reserveData) {
      throw new Error("Reserve not found");
    }

    // If simulation parameters provided, run simulation
    let simulation: ReturnType<typeof simulateApyChange> | null = null;
    if (action && amount && amount > 0) {
      simulation = simulateApyChange({
        currentTotalSupply: reserveData.totalSupply,
        currentTotalBorrow: reserveData.totalBorrow,
        action,
        amount,
        reserveConfig: reserveData.reserveConfig,
        irModifier: reserveData.irModifier,
        backstopTakeRate: reserveData.backstopTakeRate,
        blndEmissionsPerYear: reserveData.blndEmissionsPerYear ?? undefined,
        blndPrice: reserveData.blndPrice ?? undefined,
        assetPrice: reserveData.assetPrice ?? undefined,
      });
    }

    return {
      reserve: reserveData,
      simulation,
    };
  },
});
