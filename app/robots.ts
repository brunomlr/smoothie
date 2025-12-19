import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://smoothie.capital";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL.replace(/\/+$/, "")}/sitemap.xml`,
    host: BASE_URL.replace(/\/+$/, ""),
  };
}

