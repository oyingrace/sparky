"use client";

import { AppNav } from "@/components/AppNav";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Profile = {
  address: string;
  goalsCreated: number;
  goalsHonored: number;
  goalsFailed: number;
  honorRate: number;
  totalStaked: string;
  pendingPoolClaim?: string;
  streak: { current: number; longest: number };
  goals: {
    id: string;
    status: string;
    stakeAmount: string;
    deadline: string;
    isPublic: boolean;
  }[];
  bets: {
    marketId: string;
    goalId: string;
    side: number;
    amount: string;
  }[];
};

export default function ProfilePage() {
  const account = useCurrentAccount();
  const [profile, setProfile] = useState<Profile | null>(null);

  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  useEffect(() => {
    if (!account?.address) return;
    fetch(`${indexerUrl}/profiles/${account.address}`)
      .then((r) => r.json())
      .then((data) => setProfile(data.profile))
      .catch(() => setProfile(null));
  }, [account?.address, indexerUrl]);

  return (
    <>
      <AppNav />
      <main>
        <PageHeader
          eyebrow="Settle"
          title="Your record"
          lead="Honor rate, streak, and history across goals and bets."
        />

        {!account ? (
          <EmptyState
            title="Connect to view your record"
            body="Sign in with Google to see your honor rate, streak, and history."
          />
        ) : !profile ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <section className="ledger">
              <div className="ledger__inner">
                <p className="mono" style={{ margin: "0 0 1rem" }}>
                  {profile.address}
                </p>
                <div className="stat-grid">
                  <div className="stat">
                    <div className="stat-label">Honor rate</div>
                    <div className="stat-value">
                      {(profile.honorRate * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Streak</div>
                    <div className="stat-value">
                      {profile.streak.current}
                      <span className="muted" style={{ fontSize: "0.875rem", fontWeight: 400 }}>
                        {" "}
                        best {profile.streak.longest}
                      </span>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Total staked</div>
                    <div className="stat-value stat-value--mono">
                      {(Number(profile.totalStaked) / 1e9).toFixed(2)} SUI
                    </div>
                  </div>
                </div>
                <p className="muted">
                  {profile.goalsHonored} honored · {profile.goalsFailed} missed ·{" "}
                  {profile.goalsCreated} total
                </p>
                {profile.pendingPoolClaim && (
                  <p style={{ marginTop: "0.75rem" }}>
                    Pool reward:{" "}
                    <span className="mono">
                      {(Number(profile.pendingPoolClaim) / 1e9).toFixed(4)} SUI
                    </span>{" "}
                    · <Link href="/pool">Claim</Link>
                  </p>
                )}
              </div>
            </section>

            <section className="ledger" style={{ marginTop: "1.5rem" }}>
              <div className="ledger__inner">
                <h2 className="page-title" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
                  Goal history
                </h2>
                {profile.goals.length === 0 ? (
                  <EmptyState
                    title="No goals yet"
                    body="Create a commitment and stake test SUI to start building your record."
                    actionLabel="Create a goal"
                    actionHref="/goals/new"
                  />
                ) : (
                  <ul className="history-list">
                    {profile.goals.map((g) => (
                      <li key={g.id}>
                        <div className="card-row">
                          <div>
                            <p className="mono" style={{ margin: "0 0 0.35rem" }}>
                              {g.id.slice(0, 12)}…
                            </p>
                            <StatusPill status={g.status} />
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p className="mono">
                              {(Number(g.stakeAmount) / 1e9).toFixed(2)} SUI
                            </p>
                            {g.status === "active" && (
                              <Link href={`/goals/${g.id}/check-in`}>Check in</Link>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="ledger" style={{ marginTop: "1rem" }}>
              <div className="ledger__inner">
                <h2 className="page-title" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
                  Bet history
                </h2>
                {profile.bets.length === 0 ? (
                  <p className="muted">No bets placed yet.</p>
                ) : (
                  <ul className="history-list">
                    {profile.bets.map((b, i) => (
                      <li key={`${b.marketId}-${i}`}>
                        <Link href={`/markets/${b.marketId}`}>
                          {b.side === 0 ? "YES" : "NO"} on goal{" "}
                          {b.goalId.slice(0, 8)}…
                        </Link>
                        <p className="mono muted">
                          {(Number(b.amount) / 1e9).toFixed(4)} SUI
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
