export type BetRecord = {
  marketId: string;
  goalId: string;
  goalOwner: string;
  bettor: string;
  side: number;
  amount: string;
  timestampMs: number;
};

export type FraudFlag = {
  id: string;
  type: "collusion_suspect" | "heavy_counter_bet";
  severity: "low" | "medium";
  bettor: string;
  goalOwner: string;
  goalId: string;
  detail: string;
};

const bets: BetRecord[] = [];
const flags = new Map<string, FraudFlag>();

export function recordBet(bet: BetRecord) {
  bets.push(bet);
  scanForCollusion(bet);
}

export function listFraudFlags(): FraudFlag[] {
  return [...flags.values()];
}

export function listBetsByBettor(bettor: string): BetRecord[] {
  return bets.filter((b) => b.bettor === bettor);
}

export function listAllBets(): BetRecord[] {
  return [...bets];
}

function flagKey(type: string, bettor: string, goalId: string): string {
  return `${type}:${bettor}:${goalId}`;
}

function scanForCollusion(bet: BetRecord) {
  const priorWithOwner = bets.filter(
    (b) =>
      b.bettor === bet.bettor &&
      b.goalOwner === bet.goalOwner &&
      b.goalId !== bet.goalId,
  );

  if (priorWithOwner.length >= 2 && bet.side === 1) {
    const id = flagKey("collusion_suspect", bet.bettor, bet.goalId);
    flags.set(id, {
      id,
      type: "collusion_suspect",
      severity: "medium",
      bettor: bet.bettor,
      goalOwner: bet.goalOwner,
      goalId: bet.goalId,
      detail:
        "Bettor repeatedly wagers against goals from the same creator address",
    });
  }

  const counterBetsOnOwner = bets.filter(
    (b) =>
      b.bettor === bet.bettor &&
      b.goalOwner === bet.goalOwner &&
      b.side === 1,
  );
  const totalCounter = counterBetsOnOwner.reduce(
    (sum, b) => sum + BigInt(b.amount),
    0n,
  );
  if (totalCounter > 1_000_000_000n) {
    const id = flagKey("heavy_counter_bet", bet.bettor, bet.goalOwner);
    flags.set(id, {
      id,
      type: "heavy_counter_bet",
      severity: "low",
      bettor: bet.bettor,
      goalOwner: bet.goalOwner,
      goalId: bet.goalId,
      detail: "High cumulative NO stake against goals from one creator",
    });
  }
}
