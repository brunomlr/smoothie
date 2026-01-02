"use client"

import { Badge } from "@/components/ui/badge"

interface PageTitleProps {
  children: React.ReactNode
  badge?: string
}

export function PageTitle({ children, badge }: PageTitleProps) {
  return (
    <div className="pt-8 pb-10">
      <h1 className="text-2xl font-medium flex items-center gap-2">
        {children}
        {badge && (
          <Badge variant="secondary" className="text-xs font-normal">
            {badge}
          </Badge>
        )}
      </h1>
    </div>
  )
}
