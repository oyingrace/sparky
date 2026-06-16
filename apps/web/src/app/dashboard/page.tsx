"use client";

import { AppNav } from "@/components/AppNav";
import { PageHeader } from "@/components/PageHeader";
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
      setError(e instanceof Error ? e.message : "Could not load analytics");
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
        <PageHeader
          eyebrow="Internal"
          title="Founder dashboard"
          lead="Testnet metrics from the indexer. Set FOUNDER_DASHBOARD_KEY on the indexer to require a key."
        />

        <div className="ledger">
          <div className="ledger__inner card-row">
            <input
              type="password"
              placeholder="Dashboard key (optional)"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{ marginBottom: 0, flex: 1 }}
              aria-label="Dashboard key"
            />
            <button type="button" className="primary" onClick={load}>
              Refresh
            </button>
          </div>
        </div>

        {error && <p className="status-msg">{error}</p>}

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
                <div className="stat-value stat-value--mono">
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

            <section className="ledger" style={{ marginTop: "1.5rem" }}>
              <div className="ledger__inner">
                <h2 className="page-title" style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
                  Community pool
                </h2>
                <p>
                  Epoch {analytics.communityPool.currentEpochId} · Forfeited{" "}
                  <span className="mono">
                    {(Number(analytics.communityPool.forfeitedThisEpochMist) / 1e9).toFixed(4)}{" "}
                    SUI
                  </span>
                </p>
                <Link href="/fraud">View integrity flags</Link>
              </div>
            </section>

            <p className="muted" style={{ marginTop: "1.5rem" }}>
              Updated {new Date(analytics.generatedAtMs).toLocaleString()}
            </p>
          </>
        )}
      </main>
    </>
  );
}
