import type { Metadata } from "next";
import { eventsRepository } from "@/lib/db/events-repository";

interface PoolLayoutProps {
  children: React.ReactNode;
  params: Promise<{ poolId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ poolId: string }>;
}): Promise<Metadata> {
  const { poolId } = await params;
  const decodedPoolId = decodeURIComponent(poolId);

  // Try to fetch pool info from database
  let poolName = "Pool";
  let poolDescription = "";

  try {
    const pools = await eventsRepository.getPools();
    const pool = pools.find((p) => p.pool_id === decodedPoolId);
    if (pool) {
      poolName = pool.name;
      poolDescription = pool.description || "";
    }
  } catch (error) {
    console.error("Failed to fetch pool metadata:", error);
  }

  const title = `${poolName} Pool | Smoothie`;
  const description =
    poolDescription ||
    `Track your ${poolName} lending and borrowing positions on Stellar Blend. View APY rates, yields, and portfolio performance.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Smoothie",
      images: [
        {
          url: "/share.png",
          width: 1200,
          height: 630,
          alt: `${poolName} Pool - Smoothie`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/share.png"],
    },
  };
}

export default function PoolLayout({ children }: PoolLayoutProps) {
  return children;
}
