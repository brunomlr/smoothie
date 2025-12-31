"use client"

export function SupplyPositionsEmptyState() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p>No positions found for this wallet.</p>
      <p className="text-sm mt-2">
        Start by depositing assets to Blend pools.
      </p>
    </div>
  )
}
