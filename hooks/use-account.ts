import { useQuery } from "@tanstack/react-query";
import { getHorizonServer } from "@/lib/stellar/horizon";
import type { Horizon } from "@stellar/stellar-sdk";

export function useAccount(publicKey: string | undefined) {
  return useQuery({
    queryKey: ["account", publicKey],
    queryFn: async (): Promise<Horizon.AccountResponse | null> => {
      if (!publicKey) return null;

      try {
        const server = getHorizonServer();
        const account = await server.loadAccount(publicKey);
        return account;
      } catch (error: any) {
        // Account doesn't exist yet (not funded)
        if (error?.response?.status === 404) {
          return null;
        }
        console.error("Error fetching account:", error);
        return null;
      }
    },
    enabled: !!publicKey,
    staleTime: 60 * 1000, // 60 seconds for user data
    retry: false, // Don't retry if account doesn't exist
  });
}
