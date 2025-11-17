import { Version } from "@blend-capital/blend-sdk";

export interface TrackedPool {
  id: string;
  name: string;
  version: Version;
}

// Add your Blend pool IDs here
// You can find pool IDs from the Blend Protocol app at https://blend.capital
export const TRACKED_POOLS: TrackedPool[] = [
  {
    id: "CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS",
    name: "YieldBlox",
    version: Version.V2,
  },
  {
    id: "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD",
    name: "Blend Pool",
    version: Version.V2,
  },
];

// For testing, you can add pool IDs here manually
// Once you provide the pool IDs, positions will be fetched automatically
