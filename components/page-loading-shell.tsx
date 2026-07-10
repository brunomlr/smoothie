import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared wrapper for page-level Suspense fallbacks.
 *
 * Mirrors DashboardLayout's geometry (fixed-header spacers, same container
 * width and padding) so the skeleton occupies the same footprint as the real
 * page and nothing jumps when the fallback resolves. Pages render inside
 * NavigationWrapper, so the sidebar/bottom nav are already present around this.
 */
export function PageLoadingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] md:min-h-dvh flex flex-col">
      {/* Header skeleton - mobile (fixed header footprint) */}
      <div className="md:hidden px-4 pt-1.5 pb-1 flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-[140px] rounded-md" />
      </div>

      {/* Header skeleton - desktop */}
      <div className="hidden md:block">
        <div className="container max-w-3xl mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-[140px] rounded-md" />
          </div>
        </div>
      </div>

      <main className="flex-1 container max-w-3xl mx-auto px-4 py-3 sm:py-4 md:pb-6 pt-6 md:pt-8">
        {children}
      </main>
    </div>
  )
}
