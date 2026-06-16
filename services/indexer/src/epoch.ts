import type { GoalRecord } from "./store.js";

export type EpochShare = {
  address: string;
  amount: string;
};

export type EpochState = {
  epochId: number;
  forfeitedTotal: string;
  honoreeCount: number;
  shares: EpochShare[];
  published: boolean;
};

/** Compute proportional shares for users who honored commitments this epoch. */
export function computeEpochShares(
  epochId: number,
  goals: GoalRecord[],
  forfeitedTotal: bigint,
): EpochShare[] {
  const honorees = goals.filter(
    (g) => g.status === "resolved_success" && g.resolvedEpochId === epochId,
  );

  if (honorees.length === 0 || forfeitedTotal === 0n) {
    return [];
  }

  const stakeByOwner = new Map<string, bigint>();
  for (const g of honorees) {
    const stake = BigInt(g.stakeAmount);
    stakeByOwner.set(g.owner, (stakeByOwner.get(g.owner) ?? 0n) + stake);
  }

  const totalHonoredStake = [...stakeByOwner.values()].reduce(
    (a, b) => a + b,
    0n,
  );
  if (totalHonoredStake === 0n) return [];

  const shares: EpochShare[] = [];
  for (const [address, stake] of stakeByOwner) {
    const amount = (stake * forfeitedTotal) / totalHonoredStake;
    if (amount > 0n) {
      shares.push({ address, amount: amount.toString() });
    }
  }
  return shares;
}
