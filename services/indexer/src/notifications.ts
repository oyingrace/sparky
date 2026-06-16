export type NotificationKind =
  | "check_in_due"
  | "market_locking_soon"
  | "goal_resolved"
  | "reward_claimable"
  | "market_resolved";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  createdAtMs: number;
  priority: "high" | "normal" | "low";
};

import type { GoalRecord, MarketRecord } from "./store.js";
import {
  getPendingClaim,
  listGoalsByOwner,
  listMarkets,
} from "./store.js";
import { listBetsByBettor } from "./fraud.js";

const CHECK_IN_WINDOW_MS = 86_400_000;
const MARKET_LOCK_WINDOW_MS = 86_400_000;

export function getNotificationsForAddress(address: string): Notification[] {
  const now = Date.now();
  const notes: Notification[] = [];

  for (const goal of listGoalsByOwner(address)) {
    notes.push(...goalNotifications(goal, now));
  }

  for (const bet of listBetsByBettor(address)) {
    const market = listMarkets().find((m) => m.id === bet.marketId);
    if (market) {
      notes.push(...marketNotificationsForBettor(market, bet.side, now));
    }
  }

  const claim = getPendingClaim(address);
  if (claim && BigInt(claim) > 0n) {
    notes.push({
      id: `reward:${address}`,
      kind: "reward_claimable",
      title: "Community Pool reward ready",
      body: `You have ${formatSui(claim)} SUI to claim from this epoch.`,
      href: "/pool",
      createdAtMs: now,
      priority: "high",
    });
  }

  return notes.sort(
    (a, b) => priorityRank(b.priority) - priorityRank(a.priority),
  );
}

function goalNotifications(goal: GoalRecord, now: number): Notification[] {
  const notes: Notification[] = [];
  const deadline = Number(goal.deadline);

  if (goal.status === "active" && deadline - now <= CHECK_IN_WINDOW_MS) {
    notes.push({
      id: `checkin:${goal.id}`,
      kind: "check_in_due",
      title: "Check-in due soon",
      body: `Your goal deadline is ${formatRelative(deadline, now)}. Submit proof before you forfeit your stake.`,
      href: `/goals/${goal.id}/check-in`,
      createdAtMs: now,
      priority: "high",
    });
  }

  if (
    goal.status === "resolved_success" ||
    goal.status === "resolved_failure"
  ) {
    notes.push({
      id: `resolved:${goal.id}`,
      kind: "goal_resolved",
      title: goal.status === "resolved_success" ? "Goal honored" : "Goal missed",
      body:
        goal.status === "resolved_success"
          ? "Your stake was returned. Streak updated."
          : "Your stake was forfeited to the Community Pool.",
      href: "/profile",
      createdAtMs: goal.resolvedAtMs ?? now,
      priority: "normal",
    });
  }

  return notes;
}

function marketNotificationsForBettor(
  market: MarketRecord,
  side: number,
  now: number,
): Notification[] {
  const notes: Notification[] = [];
  const lockAt = Number(market.lockAt);

  if (market.status === "open" && lockAt - now <= MARKET_LOCK_WINDOW_MS) {
    notes.push({
      id: `lock:${market.id}`,
      kind: "market_locking_soon",
      title: "Market locking soon",
      body: `Betting on goal ${market.goalId.slice(0, 8)}… closes ${formatRelative(lockAt, now)}.`,
      href: `/markets/${market.id}`,
      createdAtMs: now,
      priority: "normal",
    });
  }

  if (market.status === "resolved") {
    const won =
      (market.yesWins && side === 0) || (!market.yesWins && side === 1);
    notes.push({
      id: `mres:${market.id}:${side}`,
      kind: "market_resolved",
      title: won ? "You won a bet" : "Bet lost",
      body: won
        ? "Market resolved in your favor — claim winnings."
        : "Market resolved against your position.",
      href: `/markets/${market.id}`,
      createdAtMs: now,
      priority: won ? "high" : "low",
    });
  }

  return notes;
}

function formatSui(mist: string): string {
  return (Number(mist) / 1e9).toFixed(4);
}

function formatRelative(targetMs: number, now: number): string {
  const diff = targetMs - now;
  if (diff <= 0) return "now";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

function priorityRank(p: Notification["priority"]): number {
  if (p === "high") return 3;
  if (p === "normal") return 2;
  return 1;
}

/** Hook point: external services can poll this for push/email delivery. */
export function listNotificationHooks(): string[] {
  return [
    "check_in_due",
    "market_locking_soon",
    "goal_resolved",
    "reward_claimable",
    "market_resolved",
  ];
}
