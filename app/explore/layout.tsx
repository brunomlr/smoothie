import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Blend Protocol Yields",
  description:
    "Compare current APY rates across all Blend Protocol pools on Stellar. Find the best yields for USDC, XLM, EURC and other tokens. View backstop rewards and BLND emissions.",
  keywords: [
    "Blend Protocol APY",
    "Stellar yields",
    "USDC yield",
    "XLM lending",
    "DeFi rates",
    "backstop rewards",
    "BLND emissions",
    "Stellar lending rates",
  ],
  alternates: {
    canonical: "/explore",
  },
  openGraph: {
    title: "Explore Blend Protocol Yields | Smoothie",
    description:
      "Compare current APY rates across all Blend Protocol pools. Find the best yields for USDC, XLM, and other Stellar tokens.",
    url: "/explore",
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
