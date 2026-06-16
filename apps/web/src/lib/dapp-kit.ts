import testnetDeployment from "../../../deployments/testnet.json";

const GRPC_URLS: Record<string, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
};

export const NETWORK = "testnet" as const;

export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_SPARKY_PACKAGE_ID || testnetDeployment.packageId;

export const CONFIG_ID =
  process.env.NEXT_PUBLIC_CONFIG_ID || testnetDeployment.configId;

export const COMMUNITY_POOL_ID =
  process.env.NEXT_PUBLIC_COMMUNITY_POOL_ID ||
  testnetDeployment.communityPoolId;

import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

export const dAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: NETWORK,
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
