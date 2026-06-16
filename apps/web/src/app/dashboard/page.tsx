"use client";

import { AppNav } from "@/components/AppNav";
import Link from "next/link";
import { useEffect, useState } from "react";

type Analytics = {
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

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");

  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  async function load() {
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (key) headers["x-dashboard-key"] = key;
      const res = await fetch(`${indexerUrl}/analytics`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAnalytics(data.analytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
      setAnalytics(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <AppNav />
      <main>
        <h1 style={{ marginTop: 0 }}>Founder dashboard</h1>
        <p className="muted">
          Testnet analytics from the indexer. Set{" "}
          <code>FOUNDER_DASHBOARD_KEY</code> on the indexer to require the key
          below.
        </p>

        <div className="card" style={{ display: "flex", gap: "0.75rem" }}>
          <input
            type="password"
            placeholder="Dashboard key (optional)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={{ marginBottom: 0, flex: 1 }}
          />
          <button type="button" className="primary" onClick={load}>
            Refresh
          </button>
        </div>

        {error && <p className="muted">{error}</p>}

        {analytics && (
          <>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-label">Goals</div>
                <div className="stat-value">{analytics.goals.total}</div>
                <p className="muted">
                  {analytics.goals.active} active · {analytics.goals.honored}{" "}
                  honored
                </p>
              </div>
              <div className="stat">
                <div className="stat-label">Honor rate</div>
                <div className="stat-value">
                  {(analytics.goals.honorRate * 100).toFixed(0)}%
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Markets</div>
                <div className="stat-value">{analytics.markets.total}</div>
                <p className="muted">{analytics.markets.open} open</p>
              </div>
              <div className="stat">
                <div className="stat-label">Bet volume</div>
                <div className="stat-value">
                  {(Number(analytics.markets.totalVolumeMist) / 1e9).toFixed(2)}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Users</div>
                <div className="stat-value">
                  {analytics.users.uniqueGoalSetters}
                </div>
                <p className="muted">
                  {analytics.users.uniqueBettors} bettors
                </p>
              </div>
              <div className="stat">
                <div className="stat-label">Fraud flags</div>
                <div className="stat-value">
                  {analytics.integrity.fraudFlagCount}
                </div>
                <p className="muted">
                  {analytics.integrity.flagsBySeverity.medium} medium
                </p>
              </div>
            </div>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Community Pool</h2>
              <p>
                Epoch {analytics.communityPool.currentEpochId} · Forfeited{" "}
                {(Number(analytics.communityPool.forfeitedThisEpochMist) / 1e9).toFixed(4)}{" "}
                SUI
              </p>
              <Link href="/fraud">View fraud flags →</Link>
            </section>

            <p className="muted">
              Updated {new Date(analytics.generatedAtMs).toLocaleString()}
            </p>
          </>
        )}
      </main>
    </>
  );
}
