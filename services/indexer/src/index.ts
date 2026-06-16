import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(
  readFileSync(join(__dirname, "../../../deployments/testnet.json"), "utf8"),
);

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4000);
const PACKAGE_ID = process.env.SPARKY_PACKAGE_ID ?? deployments.packageId;

app.get("/health", (_req, res) => {
  res.json({ ok: true, network: "testnet", packageId: PACKAGE_ID || null });
});

/** Goal feed — populated by event indexer (Phase 1 stub). */
app.get("/goals", (_req, res) => {
  res.json({ goals: [], note: "Indexer event subscription not yet wired" });
});

app.get("/goals/:id", (_req, res) => {
  res.status(404).json({ error: "Goal not found" });
});

app.listen(PORT, () => {
  console.log(`Sparky indexer API listening on :${PORT} (testnet)`);
});
