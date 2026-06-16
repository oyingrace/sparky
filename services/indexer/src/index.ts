import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  getGoal,
  getMarket,
  getMarketByGoal,
  listMarkets,
  listPublicGoals,
  startEventIndexer,
} from "./chain.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(
  readFileSync(join(__dirname, "../../../deployments/testnet.json"), "utf8"),
);

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4000);
const PACKAGE_ID = process.env.SPARKY_PACKAGE_ID ?? deployments.packageId;
const RPC_URL = process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443";

app.get("/health", (_req, res) => {
  res.json({ ok: true, network: "testnet", packageId: PACKAGE_ID || null });
});

app.get("/goals", (_req, res) => {
  const publicOnly = _req.query.public === "true";
  const goals = publicOnly ? listPublicGoals() : listPublicGoals();
  res.json({ goals });
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

app.get("/markets", (_req, res) => {
  const markets = listMarkets().map((m) => ({
    ...m,
    impliedOdds: computeImpliedOdds(m.yesPool, m.noPool),
  }));
  res.json({ markets });
});

app.get("/markets/:id", (req, res) => {
  const market = getMarket(req.params.id);
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  res.json({
    market,
    impliedOdds: computeImpliedOdds(market.yesPool, market.noPool),
    disclaimer:
      "Implied odds shift until lock_at; final payout depends on pool sizes at lock.",
  });
});

function computeImpliedOdds(yesPool: string, noPool: string) {
  const yes = BigInt(yesPool);
  const no = BigInt(noPool);
  if (yes === 0n && no === 0n) {
    return { yesToNo: null, noToYes: null };
  }
  if (yes === 0n) return { yesToNo: "0", noToYes: null };
  if (no === 0n) return { yesToNo: null, noToYes: "0" };
  return {
    yesToNo: (Number(no * 10000n / yes) / 10000).toFixed(4),
    noToYes: (Number(yes * 10000n / no) / 10000).toFixed(4),
  };
}

app.listen(PORT, async () => {
  console.log(`Sparky indexer API listening on :${PORT} (testnet)`);
  await startEventIndexer(PACKAGE_ID, RPC_URL);
});
