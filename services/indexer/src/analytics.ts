import { listAllBets, listFraudFlags } from "./fraud.js";
import {
  getCurrentEpochId,
  getForfeitedTotalForEpoch,
  listAllGoals,
  listMarkets,
} from "./store.js";

export type AnalyticsSnapshot = {
  generatedAtMs: number;
  goals: {
    total: number;
    active: number;
    honored: number;
    failed: number;
    honorRate: number;
    publicCount: number;
  };
  markets: {
    total: number;
    open: number;
    locked: number;
    resolved: number;
    totalVolumeMist: string;
    avgLiquidityMist: string;
  };
  communityPool: {
    currentEpochId: number;
    forfeitedThisEpochMist: string;
  };
  users: {
    uniqueGoalSetters: number;
    uniqueBettors: number;
  };
  integrity: {
    fraudFlagCount: number;
    flagsBySeverity: { low: number; medium: number };
  };
};

export function getAnalytics(): AnalyticsSnapshot {
  const goals = listAllGoals();
  const markets = listMarkets();
  const flags = listFraudFlags();
  const epochId = getCurrentEpochId();

  const active = goals.filter((g) => g.status === "active").length;
  const honored = goals.filter((g) => g.status === "resolved_success").length;
  const failed = goals.filter((g) => g.status === "resolved_failure").length;
  const resolved = honored + failed;

  let totalVolume = 0n;
  for (const m of markets) {
    totalVolume += BigInt(m.yesPool) + BigInt(m.noPool);
  }

  const setters = new Set(goals.map((g) => g.owner));
  const bettors = new Set(listAllBets().map((b) => b.bettor));

  return {
    generatedAtMs: Date.now(),
    goals: {
      total: goals.length,
      active,
      honored,
      failed,
      honorRate: resolved === 0 ? 0 : honored / resolved,
      publicCount: goals.filter((g) => g.isPublic).length,
    },
    markets: {
      total: markets.length,
      open: markets.filter((m) => m.status === "open").length,
      locked: markets.filter((m) => m.status === "locked").length,
      resolved: markets.filter((m) => m.status === "resolved").length,
      totalVolumeMist: totalVolume.toString(),
      avgLiquidityMist:
        markets.length === 0
          ? "0"
          : (totalVolume / BigInt(markets.length)).toString(),
    },
    communityPool: {
      currentEpochId: epochId,
      forfeitedThisEpochMist: getForfeitedTotalForEpoch(epochId).toString(),
    },
    users: {
      uniqueGoalSetters: setters.size,
      uniqueBettors: bettors.size,
    },
    integrity: {
      fraudFlagCount: flags.length,
      flagsBySeverity: {
        low: flags.filter((f) => f.severity === "low").length,
        medium: flags.filter((f) => f.severity === "medium").length,
      },
    },
  };
}
