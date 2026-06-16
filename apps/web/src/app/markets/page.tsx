"use client";

import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

type MarketRow = {
  id: string;
  goalId: string;
  goalOwner: string;
  lockAt: string;
  status: string;
  yesPool: string;
  noPool: string;
  impliedOdds?: {
    yesToNo: string | null;
    noToYes: string | null;
  };
};

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  useEffect(() => {
    fetch(`${indexerUrl}/markets`)
      .then((r) => r.json())
      .then((data) => setMarkets(data.markets ?? []))
      .catch(() => setMarkets([]));
  }, [indexerUrl]);

  return (
    <>
      <header>
        <div>
          <Link href="/" className="muted">
            ← Home
          </Link>
          <h1 style={{ margin: "0.5rem 0 0" }}>Prediction markets</h1>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Implied odds shift until lock — payout is fixed only after lock.
          </p>
        </div>
        <ConnectButton />
      </header>

      {markets.length === 0 ? (
        <p className="muted">No public markets indexed yet.</p>
      ) : (
        markets.map((m) => (
          <article key={m.id} className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <strong>Goal {m.goalId.slice(0, 10)}…</strong>
                <p className="muted">Status: {m.status}</p>
                <p className="muted">
                  YES pool: {(Number(m.yesPool) / 1e9).toFixed(4)} SUI · NO
                  pool: {(Number(m.noPool) / 1e9).toFixed(4)} SUI
                </p>
                {m.impliedOdds?.yesToNo && (
                  <p className="muted">
                    Implied YES:NO ≈ 1:{m.impliedOdds.yesToNo}
                  </p>
                )}
              </div>
              <Link href={`/markets/${m.id}`}>Bet →</Link>
            </div>
          </article>
        ))
      )}
    </>
  );
}
