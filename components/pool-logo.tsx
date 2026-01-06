"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { resolvePoolLogo } from "@/lib/pool-logos"

interface PoolLogoProps {
  /** Pool name - used to resolve the logo path */
  poolName: string
  /** Size in pixels (default: 24) */
  size?: number
  /** Additional CSS classes */
  className?: string
}

export function PoolLogo({ poolName, size = 24, className }: PoolLogoProps) {
  const [hasError, setHasError] = React.useState(false)
  const src = resolvePoolLogo(poolName)

  // Reset error state when poolName changes
  React.useEffect(() => {
    setHasError(false)
  }, [poolName])

  // If error loading image, show fallback
  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-white text-muted-foreground font-semibold shrink-0 overflow-hidden",
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.3 }}
      >
        {poolName.slice(0, 3).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`${poolName} pool logo`}
      width={size}
      height={size}
      className={cn("rounded-full object-contain shrink-0", className)}
      onError={() => setHasError(true)}
    />
  )
}
