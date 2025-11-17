import type { Network } from "@blend-capital/blend-sdk";
import { Networks } from "@stellar/stellar-sdk";

type SupportedNetwork = "testnet" | "mainnet";

const DEFAULT_RPC_ENDPOINTS: Record<SupportedNetwork, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org",
};

function resolveNetworkKey(): SupportedNetwork {
  const raw =
    (process.env.NEXT_PUBLIC_STELLAR_NETWORK ||
      process.env.NEXT_PUBLIC_PASSPHRASE ||
      process.env.NEXT_PUBLIC_NETWORK ||
      "testnet") as string;

  const normalized = raw.toLowerCase();
  if (
    normalized === "public" ||
    normalized === "mainnet" ||
    normalized.includes("public global stellar network")
  ) {
    return "mainnet";
  }

  if (
    normalized === "testnet" ||
    normalized.includes("test network") ||
    normalized.includes("test sdf network")
  ) {
    return "testnet";
  }

  return "testnet";
}

function resolveRpcUrl(network: SupportedNetwork): string {
  const sharedRpc =
    process.env.NEXT_PUBLIC_RPC_URL ||
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_ENDPOINT;

  if (network === "mainnet") {
    return (
      sharedRpc ||
      process.env.NEXT_PUBLIC_STELLAR_RPC_MAINNET ||
      DEFAULT_RPC_ENDPOINTS.mainnet
    );
  }

  return (
    sharedRpc ||
    process.env.NEXT_PUBLIC_STELLAR_RPC_TESTNET ||
    DEFAULT_RPC_ENDPOINTS.testnet
  );
}

export function getBlendNetwork(): Network {
  const networkKey = resolveNetworkKey();
  const rpc = resolveRpcUrl(networkKey);

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[blend] network configuration -> network=${networkKey}, rpc=${rpc}`
    );
  }

  return {
    rpc,
    passphrase: networkKey === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  };
}
