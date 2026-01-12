"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface TokenLogoProps {
  src?: string | null
  symbol: string
  size?: number
  className?: string
}

export function TokenLogo({ src, symbol, size = 48, className }: TokenLogoProps) {
  const [hasError, setHasError] = React.useState(false)

  // Reset error state when src changes
  React.useEffect(() => {
    setHasError(false)
  }, [src])

  // Check if URL is external or an API redirect (API endpoints redirect to external images)
  const useRegularImg = src?.startsWith("http") || src?.startsWith("/api/")

  // If no src or error, show fallback circle
  if (!src || hasError) {
    // Fallback: display token code in a styled container - match the image version styling
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-white text-muted-foreground font-semibold shrink-0 overflow-hidden",
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.3 }}
      >
        {symbol.slice(0, 4).toUpperCase()}
      </div>
    )
  }

  // Use regular img for external URLs and API redirects (handles redirects and various content types better)
  if (useRegularImg) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden rounded-full", className)}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${symbol} logo`}
          width={size}
          height={size}
          className="w-full h-full object-contain"
          onError={() => setHasError(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={`${symbol} logo`}
        fill
        sizes={`${size}px`}
        className="object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  )
}
