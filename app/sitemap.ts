import type { MetadataRoute } from "next";
import { eventsRepository } from "@/lib/db/events-repository";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://smoothie.capital";
const base = BASE_URL.replace(/\/+$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/explore`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${base}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  // Dynamic pool pages
  let poolPages: MetadataRoute.Sitemap = [];
  try {
    const pools = await eventsRepository.getPools();
    poolPages = pools.map((pool) => ({
      url: `${base}/pool/${encodeURIComponent(pool.pool_id)}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error("Failed to fetch pools for sitemap:", error);
  }

  return [...staticPages, ...poolPages];
}

