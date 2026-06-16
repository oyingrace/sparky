"use client";

import { AppNav } from "@/components/AppNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MarketRow = {
  id: string;
  goalId: string;
  goalOwner: string;
  lockAt: string;
  status: string;
  yesPool: string;
  noPool: string;
  liquidityMist?: string;
  impliedOdds?: {
    yesToNo: string | null;
    noToYes: string | null;
  };
};

type SortKey = "lock_at" | "liquidity" | "volume";
type StatusFilter = "" | "open" | "locked" | "resolved";

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [sort, setSort] = useState<SortKey>("lock_at");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [status, setStatus] = useState<StatusFilter>("");

  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  useEffect(() => {
    const params = new URLSearchParams({ sort, order });
    if (status) params.set("status", status);
    fetch(`${indexerUrl}/markets?${params}`)
      .then((r) => r.json())
      .then((data) => setMarkets(data.markets ?? []))
      .catch(() => setMarkets([]));
  }, [indexerUrl, sort, order, status]);

  const closingSoon = useMemo(
    () =>
      markets.filter(
        (m) => m.status === "open" && Number(m.lockAt) - Date.now() < 86_400_000,
      ).length,
    [markets],
  );

  return (
    <>
      <AppNav />
      <main>
        <h1 style={{ marginTop: 0 }}>Prediction markets</h1>
        <p className="muted">
          Implied odds shift until lock — payout is fixed only after lock.
          {closingSoon > 0 && (
            <>
              {" "}
              <span className="badge badge-warn">{closingSoon} closing soon</span>
            </>
          )}
        </p>

        <div className="filters">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="locked">Locked</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort markets"
          >
            <option value="lock_at">Closing time</option>
            <option value="liquidity">Liquidity</option>
            <option value="volume">Volume</option>
          </select>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
            aria-label="Sort order"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        {markets.length === 0 ? (
          <p className="muted">No markets match your filters.</p>
        ) : (
          markets.map((m) => (
            <article key={m.id} className="card">
              <div className="card-row">
                <div>
                  <strong>Goal {m.goalId.slice(0, 10)}…</strong>
                  <p className="muted">
                    <span className="badge">{m.status}</span>
                  </p>
                  <p className="muted">
                    YES {(Number(m.yesPool) / 1e9).toFixed(4)} · NO{" "}
                    {(Number(m.noPool) / 1e9).toFixed(4)} SUI
                  </p>
                  {m.impliedOdds?.yesToNo && (
                    <p className="muted">Implied YES:NO ≈ 1:{m.impliedOdds.yesToNo}</p>
                  )}
                  <p className="muted">
                    Locks {new Date(Number(m.lockAt)).toLocaleString()}
                  </p>
                </div>
                <Link href={`/markets/${m.id}`}>Bet →</Link>
              </div>
            </article>
          ))
        )}
      </main>
    </>
  );
}
