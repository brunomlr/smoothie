import { SorobanRpc } from "@stellar/stellar-sdk";

const RPC_URLS = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org",
};

export function getRpcUrl(): string {
  const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet") as "testnet" | "mainnet";
  return RPC_URLS[network];
}

export function getSorobanRpc(): SorobanRpc.Server {
  return new SorobanRpc.Server(getRpcUrl(), {
    allowHttp: process.env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet",
  });
}
