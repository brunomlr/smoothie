import { useMemo } from "react";
import { useAccount } from "./use-account";
import type { Horizon } from "@stellar/stellar-sdk";

export interface AssetBalance {
  id: string;
  assetCode: string;
  assetIssuer?: string;
  balance: string;
  isNative: boolean;
}

export function useWalletBalances(publicKey: string | undefined) {
  const { data: account, isLoading, error } = useAccount(publicKey);

  const balances = useMemo(() => {
    if (!account) return [];

    const assets: AssetBalance[] = [];

    account.balances.forEach((balance: Horizon.HorizonApi.BalanceLineAsset | Horizon.HorizonApi.BalanceLineNative, index: number) => {
      if (balance.asset_type === "native") {
        assets.push({
          id: `native-${index}`,
          assetCode: "XLM",
          balance: balance.balance,
          isNative: true,
        });
      } else if (
        balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12"
      ) {
        assets.push({
          id: `${balance.asset_code}-${balance.asset_issuer}-${index}`,
          assetCode: balance.asset_code,
          assetIssuer: balance.asset_issuer,
          balance: balance.balance,
          isNative: false,
        });
      }
    });

    return assets;
  }, [account]);

  const totalBalance = useMemo(() => {
    if (!balances.length) return "0";

    // For now, just sum XLM balances
    // In production, you'd convert all assets to a common currency
    const xlmBalance = balances.find((b) => b.isNative);
    return xlmBalance?.balance || "0";
  }, [balances]);

  const accountExists = !!account;

  return {
    balances,
    totalBalance,
    account,
    accountExists,
    isLoading,
    error,
  };
}
