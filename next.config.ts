import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "id.lobstr.co",
        pathname: "/*.png",
      },
      {
        protocol: "https",
        hostname: "stellar.expert",
        pathname: "/explorer/**",
      },
    ],
  },
  productionBrowserSourceMaps: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
  // Exclude Node.js-only packages from client-side bundling (WalletConnect dependencies)
  serverExternalPackages: [
    "pino",
    "thread-stream",
    "pino-pretty",
  ],
  turbopack: {
    resolveAlias: {
      // Stub out Node.js-only modules for client-side builds
      "pino": { browser: "./node_modules/pino/browser.js" },
    },
  },
};

export default nextConfig;
