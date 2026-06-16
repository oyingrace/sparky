"use client";

import { AppNav } from "@/components/AppNav";
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
        <h1 style={{ marginTop: 0 }}>Profile</h1>

        {!account ? (
          <p className="muted">Connect wallet to view profile.</p>
        ) : !profile ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <section className="card">
              <p className="muted">{profile.address}</p>
              <div className="stat-grid">
                <div className="stat">
                  <div className="stat-label">Honor rate</div>
                  <div className="stat-value">
                    {(profile.honorRate * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">Current streak</div>
                  <div className="stat-value">
                    {profile.streak.current}
                    <span className="badge badge-success" style={{ marginLeft: 8 }}>
                      best {profile.streak.longest}
                    </span>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">Total staked</div>
                  <div className="stat-value">
                    {(Number(profile.totalStaked) / 1e9).toFixed(2)}
                  </div>
                </div>
              </div>
              <p className="muted">
                {profile.goalsHonored} honored · {profile.goalsFailed} missed ·{" "}
                {profile.goalsCreated} total
              </p>
              {profile.pendingPoolClaim && (
                <p>
                  Pool reward:{" "}
                  {(Number(profile.pendingPoolClaim) / 1e9).toFixed(4)} SUI ·{" "}
                  <Link href="/pool">Claim →</Link>
                </p>
              )}
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Goal history</h2>
              {profile.goals.length === 0 ? (
                <p className="muted">No goals yet.</p>
              ) : (
                <ul className="history-list">
                  {profile.goals.map((g) => (
                    <li key={g.id}>
                      <div className="card-row">
                        <div>
                          <strong>{g.id.slice(0, 12)}…</strong>
                          <p className="muted">{g.status.replace("_", " ")}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p>{(Number(g.stakeAmount) / 1e9).toFixed(2)} SUI</p>
                          {g.status === "active" && (
                            <Link href={`/goals/${g.id}/check-in`}>Check in</Link>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Bet history</h2>
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
                      <p className="muted">
                        {(Number(b.amount) / 1e9).toFixed(4)} SUI
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
