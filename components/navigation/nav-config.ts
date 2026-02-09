import { Home, TrendingUp, Compass, History, Settings, WalletCards, LucideIcon } from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

// Primary items shown in bottom nav
export const primaryNavItems: NavItem[] = [
  {
    title: "Home",
    href: "/home",
    icon: Home,
  },
  {
    title: "Performance",
    href: "/performance",
    icon: TrendingUp,
  },
  {
    title: "Explore",
    href: "/explore",
    icon: Compass,
  },
  {
    title: "Wallet",
    href: "/wallet",
    icon: WalletCards,
  },
]

// Secondary items shown in "More" menu
export const secondaryNavItems: NavItem[] = [
  {
    title: "Activity",
    href: "/activity",
    icon: History,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

// All items combined (for sidebar)
export const navItems: NavItem[] = [...primaryNavItems, ...secondaryNavItems]
