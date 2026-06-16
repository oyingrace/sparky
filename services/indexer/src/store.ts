import {
  getJsonRpcFullnodeUrl,
  SuiJsonRpcClient,
  type EventId,
  type SuiEvent,
} from "@mysten/sui/jsonRpc";
import { recordBet } from "./fraud.js";

export type GoalRecord = {
  id: string;
  owner: string;
  descriptionHash: string;
  proofType: number;
  deadline: string;
  lockAt: string;
  stakeAmount: string;
  isPublic: boolean;
  status: "active" | "resolved_success" | "resolved_failure";
  success?: boolean;
  resolvedAtMs?: number;
  resolvedEpochId?: number;
};

export type MarketRecord = {
  id: string;
  goalId: string;
  goalOwner: string;
  lockAt: string;
  status: "open" | "locked" | "resolved";
  yesPool: string;
  noPool: string;
  yesWins?: boolean;
};

const goals = new Map<string, GoalRecord>();
const markets = new Map<string, MarketRecord>();
const marketsByGoal = new Map<string, string>();
const forfeituresByEpoch = new Map<number, bigint>();
let currentEpochId = 0;
const publishedEpochs = new Set<number>();
const pendingClaims = new Map<string, string>();

export function upsertGoal(goal: GoalRecord) {
  goals.set(goal.id, goal);
}

export function upsertMarket(market: MarketRecord) {
  markets.set(market.id, market);
  marketsByGoal.set(market.goalId, market.id);
}

export function getGoal(id: string): GoalRecord | undefined {
  return goals.get(id);
}

export function getMarket(id: string): MarketRecord | undefined {
  return markets.get(id);
}

export function getMarketByGoal(goalId: string): MarketRecord | undefined {
  const marketId = marketsByGoal.get(goalId);
  return marketId ? markets.get(marketId) : undefined;
}

export function listPublicGoals(): GoalRecord[] {
  return [...goals.values()].filter((g) => g.isPublic);
}

export function listAllGoals(): GoalRecord[] {
  return [...goals.values()];
}

export function listGoalsByOwner(owner: string): GoalRecord[] {
  return [...goals.values()].filter((g) => g.owner === owner);
}

export function listMarkets(): MarketRecord[] {
  return [...markets.values()];
}

export function getCurrentEpochId(): number {
  return currentEpochId;
}

export function getForfeitedTotalForEpoch(epochId: number): bigint {
  return forfeituresByEpoch.get(epochId) ?? 0n;
}

export function setEpochPublished(epochId: number) {
  publishedEpochs.add(epochId);
}

export function getPendingClaim(address: string): string | undefined {
  return pendingClaims.get(address);
}

export function hasPendingClaims(): boolean {
  return pendingClaims.size > 0;
}

function bytesToHex(bytes: number[] | string): string {
  if (typeof bytes === "string") return bytes;
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function eventTimestampMs(event: SuiEvent): number {
  return Number(event.timestampMs ?? Date.now());
}

function parseEvent(type: string, fields: Record<string, unknown>, event: SuiEvent) {
  if (type.endsWith("::goal::GoalCreated")) {
    const goalId = String(fields.goal_id);
    upsertGoal({
      id: goalId,
      owner: String(fields.owner),
      descriptionHash: bytesToHex(fields.description_hash as number[]),
      proofType: Number(fields.proof_type),
      deadline: String(fields.deadline),
      lockAt: String(fields.lock_at),
      stakeAmount: String(fields.stake_amount),
      isPublic: Boolean(fields.is_public),
      status: "active",
    });
  }

  if (type.endsWith("::goal::GoalResolved")) {
    const goalId = String(fields.goal_id);
    const existing = goals.get(goalId);
    if (existing) {
      const success = Boolean(fields.success);
      upsertGoal({
        ...existing,
        status: success ? "resolved_success" : "resolved_failure",
        success,
        resolvedAtMs: eventTimestampMs(event),
        resolvedEpochId: currentEpochId,
      });
    }
  }

  if (type.endsWith("::community_pool::StakeForfeited")) {
    const epochId = Number(fields.epoch_id);
    const amount = BigInt(String(fields.amount));
    forfeituresByEpoch.set(
      epochId,
      (forfeituresByEpoch.get(epochId) ?? 0n) + amount,
    );
  }

  if (type.endsWith("::community_pool::EpochPublished")) {
    const epochId = Number(fields.epoch_id);
    publishedEpochs.add(epochId);
    currentEpochId = epochId;
  }

  if (type.endsWith("::community_pool::RewardClaimed")) {
    const claimant = String(fields.claimant);
    pendingClaims.delete(claimant);
  }

  if (type.endsWith("::market::MarketCreated")) {
    const marketId = String(fields.market_id);
    upsertMarket({
      id: marketId,
      goalId: String(fields.goal_id),
      goalOwner: String(fields.goal_owner),
      lockAt: String(fields.lock_at),
      status: "open",
      yesPool: "0",
      noPool: "0",
    });
  }

  if (type.endsWith("::market::BetPlaced")) {
    const marketId = String(fields.market_id);
    const existing = markets.get(marketId);
    if (existing) {
      upsertMarket({
        ...existing,
        yesPool: String(fields.yes_pool),
        noPool: String(fields.no_pool),
      });
    }
    recordBet({
      marketId,
      goalId: String(fields.goal_id),
      goalOwner: existing?.goalOwner ?? "",
      bettor: String(fields.bettor),
      side: Number(fields.side),
      amount: String(fields.amount),
      timestampMs: eventTimestampMs(event),
    });
  }

  if (type.endsWith("::market::MarketLocked")) {
    const marketId = String(fields.market_id);
    const existing = markets.get(marketId);
    if (existing) {
      upsertMarket({
        ...existing,
        status: "locked",
        yesPool: String(fields.yes_pool),
        noPool: String(fields.no_pool),
      });
    }
  }

  if (type.endsWith("::market::MarketResolved")) {
    const marketId = String(fields.market_id);
    const existing = markets.get(marketId);
    if (existing) {
      upsertMarket({
        ...existing,
        status: "resolved",
        yesPool: String(fields.yes_pool),
        noPool: String(fields.no_pool),
        yesWins: Boolean(fields.yes_wins),
      });
    }
  }
}

export function ingestEvent(event: SuiEvent) {
  if (event.parsedJson && typeof event.parsedJson === "object") {
    parseEvent(event.type, event.parsedJson as Record<string, unknown>, event);
  }
}

export function createSuiClient(rpcUrl?: string) {
  return new SuiJsonRpcClient({
    network: "testnet",
    url: rpcUrl ?? getJsonRpcFullnodeUrl("testnet"),
  });
}

async function queryModuleEvents(
  client: SuiJsonRpcClient,
  packageId: string,
  module: string,
) {
  let cursor: EventId | null | undefined = undefined;
  do {
    const page = await client.queryEvents({
      query: { MoveModule: { package: packageId, module } },
      cursor: cursor ?? undefined,
      limit: 50,
    });
    for (const event of page.data) {
      ingestEvent(event);
    }
    cursor = page.nextCursor ?? null;
  } while (cursor);
}

export async function backfillEvents(client: SuiJsonRpcClient, packageId: string) {
  await queryModuleEvents(client, packageId, "goal");
  await queryModuleEvents(client, packageId, "market");
  await queryModuleEvents(client, packageId, "community_pool");
}

export function setPendingClaims(shares: { address: string; amount: string }[]) {
  pendingClaims.clear();
  for (const s of shares) {
    pendingClaims.set(s.address, s.amount);
  }
}
