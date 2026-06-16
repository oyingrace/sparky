import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildProfile,
  computeEpochShares,
  getAnalytics,
  getEpochState,
  getGoal,
  getMarket,
  getMarketByGoal,
  getNotificationsForAddress,
  listFraudFlags,
  listMarkets,
  listMarketsSorted,
  listPublicGoals,
  startEventIndexer,
  type MarketListOptions,
} from "./chain.js";
import {
  getCurrentEpochId,
  getForfeitedTotalForEpoch,
  listAllGoals,
} from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(
  readFileSync(join(__dirname, "../../../deployments/testnet.json"), "utf8"),
);

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4000);
const PACKAGE_ID = process.env.SPARKY_PACKAGE_ID ?? deployments.packageId;
const RPC_URL = process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443";
const DASHBOARD_KEY = process.env.FOUNDER_DASHBOARD_KEY ?? "";

app.get("/health", (_req, res) => {
  res.json({ ok: true, network: "testnet", packageId: PACKAGE_ID || null });
});

app.get("/goals", (_req, res) => {
  res.json({ goals: listPublicGoals() });
});

app.get("/goals/:id", (req, res) => {
  const goal = getGoal(req.params.id);
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  const market = getMarketByGoal(goal.id);
  res.json({ goal, market: market ?? null });
});

app.get("/markets", (req, res) => {
  const options: MarketListOptions = {
    status: parseStatus(req.query.status),
    sort: parseSort(req.query.sort),
    order: req.query.order === "desc" ? "desc" : "asc",
  };
  const markets = listMarketsSorted(listMarkets(), options);
  res.json({ markets, sort: options.sort ?? "lock_at", order: options.order });
});

app.get("/markets/:id", (req, res) => {
  const market = getMarket(req.params.id);
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  const enriched = listMarketsSorted([market])[0];
  res.json({
    market: enriched,
    disclaimer:
      "Implied odds shift until lock_at; final payout depends on pool sizes at lock.",
  });
});

app.get("/profiles/:address", (req, res) => {
  res.json({ profile: buildProfile(req.params.address) });
});

app.get("/notifications", (req, res) => {
  const address = String(req.query.address ?? "");
  if (!address) {
    res.status(400).json({ error: "address query param required" });
    return;
  }
  res.json({ notifications: getNotificationsForAddress(address) });
});

app.get("/epochs/current", (_req, res) => {
  const epochId = getCurrentEpochId();
  const forfeitedTotal = getForfeitedTotalForEpoch(epochId);
  const shares = computeEpochShares(epochId, listAllGoals(), forfeitedTotal);
  res.json({
    epochId,
    forfeitedTotal: forfeitedTotal.toString(),
    shares,
    schedulerState: getEpochState(),
  });
});

app.get("/fraud/flags", (_req, res) => {
  res.json({ flags: listFraudFlags() });
});

app.get("/analytics", (req, res) => {
  if (DASHBOARD_KEY && req.headers["x-dashboard-key"] !== DASHBOARD_KEY) {
    res.status(401).json({ error: "Invalid or missing x-dashboard-key header" });
    return;
  }
  res.json({ analytics: getAnalytics() });
});

function parseStatus(value: unknown): MarketListOptions["status"] {
  if (value === "open" || value === "locked" || value === "resolved") {
    return value;
  }
  return undefined;
}

function parseSort(value: unknown): MarketListOptions["sort"] {
  if (value === "liquidity" || value === "volume" || value === "lock_at") {
    return value;
  }
  return undefined;
}

app.listen(PORT, async () => {
  console.log(`Sparky indexer API listening on :${PORT} (testnet)`);
  await startEventIndexer(PACKAGE_ID, RPC_URL, {
    communityPoolId: process.env.COMMUNITY_POOL_ID ?? deployments.communityPoolId,
    adminCapId: process.env.ADMIN_CAP_ID ?? deployments.adminCapId,
    configId: process.env.CONFIG_ID ?? deployments.configId,
  });
});
