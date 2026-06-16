import type { GoalRecord } from "./store.js";
import { listBetsByBettor, type BetRecord } from "./fraud.js";
import {
  getCurrentEpochId,
  getPendingClaim,
  listGoalsByOwner,
} from "./store.js";

export type StreakStats = {
  current: number;
  longest: number;
};

export type EnhancedProfile = {
  address: string;
  goalsCreated: number;
  goalsHonored: number;
  goalsFailed: number;
  honorRate: number;
  totalStaked: string;
  currentEpochId: number;
  pendingPoolClaim?: string;
  streak: StreakStats;
  goals: GoalRecord[];
  bets: BetRecord[];
};

export function computeStreak(goals: GoalRecord[]): StreakStats {
  const resolved = goals
    .filter(
      (g) =>
        g.status === "resolved_success" || g.status === "resolved_failure",
    )
    .sort((a, b) => (a.resolvedAtMs ?? 0) - (b.resolvedAtMs ?? 0));

  let longest = 0;
  let run = 0;
  for (const g of resolved) {
    if (g.status === "resolved_success") {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  let current = 0;
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (resolved[i].status === "resolved_success") current++;
    else break;
  }

  return { current, longest };
}

export function buildProfile(address: string): EnhancedProfile {
  const goals = listGoalsByOwner(address);
  const honored = goals.filter((g) => g.status === "resolved_success").length;
  const failed = goals.filter((g) => g.status === "resolved_failure").length;
  const resolved = honored + failed;
  const totalStaked = goals.reduce(
    (sum, g) => sum + BigInt(g.stakeAmount),
    0n,
  );

  return {
    address,
    goalsCreated: goals.length,
    goalsHonored: honored,
    goalsFailed: failed,
    honorRate: resolved === 0 ? 0 : honored / resolved,
    totalStaked: totalStaked.toString(),
    currentEpochId: getCurrentEpochId(),
    pendingPoolClaim: getPendingClaim(address),
    streak: computeStreak(goals),
    goals: [...goals].sort(
      (a, b) => Number(b.deadline) - Number(a.deadline),
    ),
    bets: listBetsByBettor(address),
  };
}
