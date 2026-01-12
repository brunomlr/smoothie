/**
 * Wallet Operations API Route
 *
 * Returns operations history for a given user address from Horizon.
 * This provides general wallet activity (payments, trustline changes, etc.)
 * as opposed to Blend-specific protocol events.
 */

import { NextRequest } from "next/server"
import {
  createApiHandler,
  requireString,
  optionalString,
  optionalInt,
  resolveWalletAddress,
  CACHE_CONFIGS,
} from "@/lib/api"
import { getHorizonServer } from "@/lib/stellar/horizon"
import type { Horizon } from "@stellar/stellar-sdk"

export interface WalletOperation {
  id: string
  type: string
  createdAt: string
  transactionHash: string
  sourceAccount: string
  pagingToken: string
  // Payment specific
  from?: string
  to?: string
  amount?: string
  assetType?: string
  assetCode?: string
  assetIssuer?: string
  // Create account specific
  account?: string
  startingBalance?: string
  // Change trust specific
  trustor?: string
  trustee?: string
  limit?: string
  // Path payment specific
  sourceAmount?: string
  sourceAssetType?: string
  sourceAssetCode?: string
  sourceAssetIssuer?: string
  // Account merge specific
  into?: string
  // Manage data
  name?: string
  value?: string
  // Bump sequence
  bumpTo?: string
  // Invoke host function (Soroban)
  function?: string
}

export interface WalletOperationsResponse {
  operations: WalletOperation[]
  nextCursor?: string
}

function parseOperation(op: Horizon.ServerApi.OperationRecord): WalletOperation {
  const base: WalletOperation = {
    id: op.id,
    type: op.type,
    createdAt: op.created_at,
    transactionHash: op.transaction_hash,
    sourceAccount: op.source_account,
    pagingToken: op.paging_token,
  }

  // Type-specific fields
  switch (op.type) {
    case "payment": {
      const payment = op as Horizon.ServerApi.PaymentOperationRecord
      return {
        ...base,
        from: payment.from,
        to: payment.to,
        amount: payment.amount,
        assetType: payment.asset_type,
        assetCode: payment.asset_type === "native" ? "XLM" : payment.asset_code,
        assetIssuer: payment.asset_type === "native" ? undefined : payment.asset_issuer,
      }
    }

    case "create_account": {
      const create = op as Horizon.ServerApi.CreateAccountOperationRecord
      return {
        ...base,
        account: create.account,
        startingBalance: create.starting_balance,
        from: create.funder,
      }
    }

    case "change_trust": {
      const trust = op as Horizon.ServerApi.ChangeTrustOperationRecord
      return {
        ...base,
        assetType: trust.asset_type,
        assetCode: trust.asset_code,
        assetIssuer: trust.asset_issuer,
        limit: trust.limit,
        trustor: trust.trustor,
        trustee: trust.trustee,
      }
    }

    case "path_payment_strict_send":
    case "path_payment_strict_receive": {
      const path = op as Horizon.ServerApi.PathPaymentOperationRecord
      return {
        ...base,
        from: path.from,
        to: path.to,
        amount: path.amount,
        assetType: path.asset_type,
        assetCode: path.asset_type === "native" ? "XLM" : path.asset_code,
        assetIssuer: path.asset_type === "native" ? undefined : path.asset_issuer,
        sourceAmount: path.source_amount,
        sourceAssetType: path.source_asset_type,
        sourceAssetCode: path.source_asset_type === "native" ? "XLM" : path.source_asset_code,
        sourceAssetIssuer: path.source_asset_type === "native" ? undefined : path.source_asset_issuer,
      }
    }

    case "account_merge": {
      const merge = op as Horizon.ServerApi.AccountMergeOperationRecord
      return {
        ...base,
        into: merge.into,
      }
    }

    case "manage_data": {
      const data = op as Horizon.ServerApi.ManageDataOperationRecord
      return {
        ...base,
        name: data.name,
        value: data.value ? Buffer.from(data.value).toString("utf-8") : undefined,
      }
    }

    case "bump_sequence": {
      const bump = op as Horizon.ServerApi.BumpSequenceOperationRecord
      return {
        ...base,
        bumpTo: bump.bump_to,
      }
    }

    case "invoke_host_function": {
      const invoke = op as unknown as { function?: string }
      return {
        ...base,
        function: invoke.function || "invoke_host_function",
      }
    }

    default:
      return base
  }
}

export const GET = createApiHandler<WalletOperationsResponse>({
  logPrefix: "[Wallet Operations API]",
  cache: CACHE_CONFIGS.SHORT, // 1 minute cache

  async handler(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams

    // Get user parameter and resolve (handles demo wallet aliases)
    const userParam = requireString(searchParams, "user")
    const userAddress = resolveWalletAddress(userParam)
    const cursor = optionalString(searchParams, "cursor")
    const limit = optionalInt(searchParams, "limit", 50)

    // Filter function to exclude unwanted operations
    const shouldIncludeOperation = (op: WalletOperation): boolean => {
      // Filter out create claimable balance operations
      if (op.type === "create_claimable_balance") {
        return false
      }
      // Filter out small XLM payments (dust/spam) - only for received payments
      if (op.type === "payment" && op.assetCode === "XLM" && op.to === userAddress) {
        const amount = parseFloat(op.amount || "0")
        if (amount < 0.001) {
          return false
        }
      }
      return true
    }

    try {
      const server = getHorizonServer()
      const operations: WalletOperation[] = []
      let currentCursor = cursor
      let hasMoreRecords = true
      const maxIterations = 10 // Safety limit to prevent infinite loops
      let iterations = 0

      // Keep fetching until we have enough valid operations or run out of records
      while (operations.length < limit && iterations < maxIterations && hasMoreRecords) {
        iterations++

        // Build query for operations
        let query = server
          .operations()
          .forAccount(userAddress)
          .order("desc")
          .limit(limit) // Fetch more to account for filtered operations

        if (currentCursor) {
          query = query.cursor(currentCursor)
        }

        const response = await query.call()

        // No more records available
        if (response.records.length === 0) {
          hasMoreRecords = false
          break
        }

        // Parse and filter operations
        const newOperations = response.records
          .map(parseOperation)
          .filter(shouldIncludeOperation)

        operations.push(...newOperations)

        // Update cursor for next iteration
        currentCursor = response.records[response.records.length - 1].paging_token

        // If we got fewer records than requested, we've reached the end
        if (response.records.length < limit) {
          hasMoreRecords = false
        }
      }

      // Trim to requested limit
      const trimmedOperations = operations.slice(0, limit)

      // Determine next cursor from the last operation we're returning
      // This ensures pagination continues from the correct position
      let nextCursor: string | undefined
      if (trimmedOperations.length > 0 && (operations.length > limit || hasMoreRecords)) {
        nextCursor = trimmedOperations[trimmedOperations.length - 1].pagingToken
      }

      return {
        operations: trimmedOperations,
        nextCursor,
      }
    } catch (error) {
      console.error("[Wallet Operations API] Error fetching operations:", error)
      return { operations: [] }
    }
  },
})
