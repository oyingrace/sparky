import {
  backfillEvents,
  createSuiClient,
  getGoal,
  getMarket,
  getMarketByGoal,
  listMarkets,
  listPublicGoals,
} from "./store.js";
import { getEpochState, startEpochScheduler } from "./scheduler.js";
import { listFraudFlags } from "./fraud.js";
import { computeEpochShares } from "./epoch.js";
import { buildProfile } from "./profile.js";
import { getNotificationsForAddress, listNotificationHooks } from "./notifications.js";
import { getAnalytics } from "./analytics.js";
import { listMarketsSorted, type MarketListOptions } from "./markets.js";

export async function startEventIndexer(
  packageId: string,
  rpcUrl?: string,
  deployment?: {
    communityPoolId?: string;
    adminCapId?: string;
    configId?: string;
  },
) {
  if (!packageId) {
    console.warn("SPARKY_PACKAGE_ID not set — indexer idle until publish");
    return;
  }

  const client = createSuiClient(rpcUrl);

  const poll = async () => {
    try {
      await backfillEvents(client, packageId);
    } catch (err) {
      console.error("Indexer poll error:", err);
    }
  };

  await poll();
  setInterval(poll, 15_000);
  console.log("Indexer polling Sparky events every 15s");

  if (deployment?.communityPoolId) {
    startEpochScheduler(
      packageId,
      deployment.communityPoolId,
      deployment.adminCapId ?? "",
      rpcUrl,
    );
  }
}

export {
  getGoal,
  getMarket,
  getMarketByGoal,
  listMarkets,
  listPublicGoals,
  getEpochState,
  listFraudFlags,
  computeEpochShares,
  buildProfile,
  getNotificationsForAddress,
  listNotificationHooks,
  getAnalytics,
  listMarketsSorted,
};
export type { MarketListOptions };
