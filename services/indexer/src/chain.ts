import {
  backfillEvents,
  createSuiClient,
  getGoal,
  getMarket,
  getMarketByGoal,
  listMarkets,
  listPublicGoals,
} from "./store.js";

export async function startEventIndexer(packageId: string, rpcUrl?: string) {
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
  console.log("Indexer polling Sparky goal + market events every 15s");
}

export {
  getGoal,
  getMarket,
  getMarketByGoal,
  listMarkets,
  listPublicGoals,
};
