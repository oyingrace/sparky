import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { computeEpochShares, type EpochState } from "./epoch.js";
import {
  createSuiClient,
  getCurrentEpochId,
  getForfeitedTotalForEpoch,
  hasPendingClaims,
  listAllGoals,
  setEpochPublished,
  setPendingClaims,
} from "./store.js";

const WEEK_MS = 7 * 86_400_000;

let lastPublishAt = 0;
let currentEpochState: EpochState | null = null;

export function getEpochState(): EpochState | null {
  return currentEpochState;
}

export function startEpochScheduler(
  packageId: string,
  communityPoolId: string,
  adminCapId: string,
  rpcUrl?: string,
) {
  const intervalMs = Number(process.env.EPOCH_INTERVAL_MS ?? WEEK_MS);

  const tick = async () => {
    try {
      await maybePublishEpoch(
        packageId,
        communityPoolId,
        adminCapId,
        rpcUrl,
        intervalMs,
      );
    } catch (err) {
      console.error("Epoch scheduler error:", err);
    }
  };

  setInterval(tick, 60_000);
  tick();
}

async function maybePublishEpoch(
  packageId: string,
  communityPoolId: string,
  adminCapId: string,
  rpcUrl: string | undefined,
  intervalMs: number,
) {
  const epochId = getCurrentEpochId();
  const forfeitedTotal = getForfeitedTotalForEpoch(epochId);
  const shares = computeEpochShares(epochId, listAllGoals(), forfeitedTotal);

  currentEpochState = {
    epochId,
    forfeitedTotal: forfeitedTotal.toString(),
    honoreeCount: shares.length,
    shares,
    published: false,
  };

  const adminKey = process.env.ADMIN_PRIVATE_KEY;
  if (!adminKey || !packageId || !communityPoolId || shares.length === 0) {
    return;
  }

  if (hasPendingClaims()) {
    return;
  }

  const now = Date.now();
  if (now - lastPublishAt < intervalMs) {
    return;
  }

  const keypair = Ed25519Keypair.fromSecretKey(adminKey);
  const client = createSuiClient(rpcUrl);
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::community_pool::publish_epoch_claims`,
    arguments: [
      tx.object(adminCapId),
      tx.object(communityPoolId),
      tx.pure.u64(epochId),
      tx.pure.vector(
        "address",
        shares.map((s) => s.address),
      ),
      tx.pure.vector(
        "u64",
        shares.map((s) => BigInt(s.amount)),
      ),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
  });

  setPendingClaims(shares);
  setEpochPublished(epochId);
  lastPublishAt = now;
  if (currentEpochState) {
    currentEpochState.published = true;
  }
  console.log(`Epoch ${epochId} claims published: ${result.digest}`);
}
