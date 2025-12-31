"use client"

import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

export function WalletBalanceSkeleton() {
  return (
    <div className="@container/card">
      {/* Header section */}
      <div className="flex flex-col space-y-1.5 pt-6">
        {/* APY badge row */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        {/* Balance */}
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-8 w-40 @[250px]/card:w-56 @[250px]/card:h-10 @[400px]/card:h-12" />
        </div>

        {/* Yield info */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Skeleton className="h-5 w-28 @[250px]/card:w-36" />
        </div>
      </div>

      {/* Chart section */}
      <div className="pb-6">
        <div className="pt-4">
          {/* Chart area - matches actual chart aspect ratio */}
          <Skeleton className="aspect-[2/1] md:aspect-[7/2] w-full rounded-md" />
          {/* Period selector - centered below chart like actual */}
          <div className="flex justify-center mt-2">
            <Skeleton className="h-9 sm:h-10 w-56 sm:w-64 rounded-md" />
          </div>
        </div>
      </div>

      {/* Stats section */}
      <div className="flex flex-col @[350px]/card:flex-row items-stretch gap-2 @[350px]/card:gap-4 pb-2">
        <div className="flex flex-1 flex-row @[350px]/card:flex-col @[350px]/card:items-center gap-2 @[350px]/card:gap-0.5 py-2 justify-between @[350px]/card:justify-start">
          <Skeleton className="h-3 w-16 @[250px]/card:h-4" />
          <Skeleton className="h-5 w-20 @[250px]/card:h-6" />
        </div>

        <Separator orientation="horizontal" className="@[350px]/card:hidden" />
        <Separator orientation="vertical" className="self-stretch hidden @[350px]/card:block" />

        <div className="flex flex-1 flex-row @[350px]/card:flex-col @[350px]/card:items-center gap-2 @[350px]/card:gap-0.5 py-2 justify-between @[350px]/card:justify-start">
          <Skeleton className="h-3 w-20 @[250px]/card:h-4" />
          <Skeleton className="h-5 w-20 @[250px]/card:h-6" />
        </div>

        <Separator orientation="horizontal" className="@[350px]/card:hidden" />
        <Separator orientation="vertical" className="self-stretch hidden @[350px]/card:block" />

        <div className="flex flex-1 flex-row @[350px]/card:flex-col @[350px]/card:items-center gap-2 @[350px]/card:gap-0.5 py-2 justify-between @[350px]/card:justify-start">
          <Skeleton className="h-3 w-20 @[250px]/card:h-4" />
          <Skeleton className="h-5 w-20 @[250px]/card:h-6" />
        </div>
      </div>
    </div>
  )
}
