"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { primaryNavItems, secondaryNavItems } from "./nav-config"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

export function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isSecondaryActive = secondaryNavItems.some(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  )

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[max(0px,calc(env(safe-area-inset-bottom)-10px))]">
        <div className="flex items-center justify-around h-14 px-2">
          {primaryNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 pb-1 transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <item.icon
                  key={isActive ? `${item.href}-active` : item.href}
                  className={cn("h-5 w-5", isActive && "text-foreground animate-icon-bounce")}
                />
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.title}
                </span>
              </Link>
            )
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 pb-1 transition-colors",
              isSecondaryActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className={cn("h-5 w-5", isSecondaryActive && "animate-icon-bounce")} />
            <span className={cn(
              "text-[10px] font-medium",
              isSecondaryActive ? "text-foreground" : "text-muted-foreground"
            )}>
              More
            </span>
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <VisuallyHidden>
            <DrawerTitle>More options</DrawerTitle>
          </VisuallyHidden>
          <div className="p-4 pb-8">
            {secondaryNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))

              return (
                <DrawerClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.title}
                  </Link>
                </DrawerClose>
              )
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
