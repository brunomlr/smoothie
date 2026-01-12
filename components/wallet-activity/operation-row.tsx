"use client"

import { ExternalLink } from "lucide-react"
import Image from "next/image"
import { TableCell, TableRow } from "@/components/ui/table"
import type { WalletOperation } from "@/app/api/wallet-operations/route"
import { OperationBadge } from "./operation-badge"
import { ASSET_LOGO_MAP } from "./constants"

interface OperationRowProps {
  operation: WalletOperation
  currentUserAddress?: string
  isDemoWallet?: boolean
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatAmount(amount: string | undefined): string {
  if (!amount) return "-"
  const value = parseFloat(amount)
  const isWholeNumber = value % 1 === 0
  return value.toLocaleString("en-US", {
    minimumFractionDigits: isWholeNumber ? 0 : 2,
    maximumFractionDigits: 4,
  })
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function getAssetLogo(assetCode: string | undefined): string | null {
  if (!assetCode) return null
  const normalized = assetCode.toUpperCase()
  return ASSET_LOGO_MAP[normalized] ?? null
}

function OperationAmount({
  operation,
  currentUserAddress,
}: {
  operation: WalletOperation
  currentUserAddress?: string
}) {
  const { type, amount, assetCode, sourceAmount, sourceAssetCode, startingBalance, to } = operation

  // Handle different operation types
  if (type === "payment" || type === "path_payment_strict_send" || type === "path_payment_strict_receive") {
    if (!amount || !assetCode) return <span className="text-muted-foreground">-</span>

    const logo = getAssetLogo(assetCode)
    const isReceiving = to === currentUserAddress
    const prefix = isReceiving ? "+" : "-"
    const colorClass = isReceiving ? "text-green-600 dark:text-green-400" : ""

    return (
      <div className="flex items-center gap-2">
        {logo && (
          <Image
            src={logo}
            alt={assetCode}
            width={20}
            height={20}
            className="rounded-full"
          />
        )}
        <div className="flex flex-col">
          <span className={`font-medium ${colorClass}`}>
            {prefix}{formatAmount(amount)} {assetCode}
          </span>
          {sourceAmount && sourceAssetCode && sourceAssetCode !== assetCode && (
            <span className="text-xs text-muted-foreground">
              from {formatAmount(sourceAmount)} {sourceAssetCode}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (type === "create_account" && startingBalance) {
    return (
      <div className="flex items-center gap-2">
        <Image
          src="/tokens/xlm.png"
          alt="XLM"
          width={20}
          height={20}
          className="rounded-full"
        />
        <span className="font-medium">
          {formatAmount(startingBalance)} XLM
        </span>
      </div>
    )
  }

  if (type === "change_trust" && assetCode) {
    const logo = getAssetLogo(assetCode)
    return (
      <div className="flex items-center gap-2">
        {logo && (
          <Image
            src={logo}
            alt={assetCode}
            width={20}
            height={20}
            className="rounded-full"
          />
        )}
        <span className="font-medium">{assetCode}</span>
      </div>
    )
  }

  return <span className="text-muted-foreground">-</span>
}

function OperationDetails({ operation }: { operation: WalletOperation }) {
  const { type, to, from, account, into, name } = operation

  if (type === "payment" || type === "path_payment_strict_send" || type === "path_payment_strict_receive") {
    if (from && to) {
      return (
        <span className="text-xs text-muted-foreground">
          {truncateAddress(from)} → {truncateAddress(to)}
        </span>
      )
    }
  }

  if (type === "create_account" && account) {
    return (
      <span className="text-xs text-muted-foreground">
        New: {truncateAddress(account)}
      </span>
    )
  }

  if (type === "account_merge" && into) {
    return (
      <span className="text-xs text-muted-foreground">
        Into: {truncateAddress(into)}
      </span>
    )
  }

  if (type === "manage_data" && name) {
    return (
      <span className="text-xs text-muted-foreground">
        Key: {name.length > 20 ? `${name.slice(0, 20)}...` : name}
      </span>
    )
  }

  if (type === "invoke_host_function") {
    return (
      <span className="text-xs text-muted-foreground">
        Soroban Contract Call
      </span>
    )
  }

  return null
}

export function OperationRow({
  operation,
  currentUserAddress,
  isDemoWallet,
}: OperationRowProps) {
  const explorerUrl = `https://stellar.expert/explorer/public/tx/${operation.transactionHash}`

  return (
    <TableRow className="hover:bg-transparent border-b border-border/50 last:border-b-0">
      <TableCell className="pl-4">
        <OperationBadge operation={operation} currentUserAddress={currentUserAddress} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <OperationAmount operation={operation} currentUserAddress={currentUserAddress} />
          <OperationDetails operation={operation} />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col text-sm">
          <span>{formatDate(operation.createdAt)}</span>
          <span className="text-muted-foreground text-xs">
            {formatTime(operation.createdAt)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {isDemoWallet ? (
          <span className="font-mono text-xs text-muted-foreground">
            {operation.transactionHash.slice(0, 8)}...
          </span>
        ) : (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="font-mono text-xs">{operation.transactionHash.slice(0, 8)}...</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </TableCell>
    </TableRow>
  )
}

export function MobileOperationCard({
  operation,
  currentUserAddress,
  isDemoWallet,
}: OperationRowProps) {
  const explorerUrl = `https://stellar.expert/explorer/public/tx/${operation.transactionHash}`

  return (
    <div className="py-3 px-4 space-y-3 border-b border-border/50 last:border-b-0">
      <div className="flex justify-between items-center">
        <OperationBadge operation={operation} currentUserAddress={currentUserAddress} />
        <div className="flex items-center gap-2">
          <div className="text-right text-xs text-muted-foreground">
            {formatDate(operation.createdAt)} {formatTime(operation.createdAt)}
          </div>
          {!isDemoWallet && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <OperationDetails operation={operation} />
        <div className="w-36 text-right">
          <OperationAmount operation={operation} currentUserAddress={currentUserAddress} />
        </div>
      </div>
    </div>
  )
}
