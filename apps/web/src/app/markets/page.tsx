"use client";

import { AppNav } from "@/components/AppNav";
import { EmptyState } from "@/components/EmptyState";
import { OddsLine } from "@/components/OddsLine";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
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
        <PageHeader
          eyebrow="Wager"
          title="Prediction markets"
          lead="Odds move until lock. Final payout depends on pool sizes when betting closes."
          action={
            closingSoon > 0 ? (
              <span className="pill pill--locked">{closingSoon} closing soon</span>
            ) : undefined
          }
        />

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
          <EmptyState
            title="No markets match"
            body="Try a different filter, or create a public goal to open a market."
            actionLabel="Create a goal"
            actionHref="/goals/new"
          />
        ) : (
          markets.map((m) => (
            <article
              key={m.id}
              className={`ledger ${m.status === "resolved" ? "ledger--settled" : m.status === "locked" ? "ledger--warn" : ""}`}
            >
              <div className="ledger__inner">
                <div className="card-row">
                  <div>
                    <p className="mono" style={{ margin: "0 0 0.5rem" }}>
                      Goal {m.goalId.slice(0, 10)}…
                    </p>
                    <StatusPill status={m.status} />
                    <div style={{ marginTop: "0.75rem" }}>
                      <OddsLine
                        yesPool={m.yesPool}
                        noPool={m.noPool}
                        yesToNo={m.impliedOdds?.yesToNo}
                      />
                    </div>
                    <p className="muted" style={{ marginTop: "0.5rem" }}>
                      Locks {new Date(Number(m.lockAt)).toLocaleString()}
                    </p>
                  </div>
                  <Link href={`/markets/${m.id}`} className="secondary-btn">
                    Place bet
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </main>
    </>
  );
}
