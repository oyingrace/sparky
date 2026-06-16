"use client";

import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

type GoalRow = {
  id: string;
  descriptionHash: string;
  status: string;
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  useEffect(() => {
    fetch(`${indexerUrl}/goals`)
      .then((r) => r.json())
      .then((data) => setGoals(data.goals ?? []))
      .catch(() => setGoals([]));
  }, [indexerUrl]);

  return (
    <>
      <header>
        <div>
          <Link href="/" className="muted">
            ← Home
          </Link>
          <h1 style={{ margin: "0.5rem 0 0" }}>Goals</h1>
        </div>
        <ConnectButton />
      </header>

      {goals.length === 0 ? (
        <p className="muted">No indexed goals yet.</p>
      ) : (
        goals.map((g) => (
          <article key={g.id} className="card">
            <strong>{g.id}</strong>
            <p className="muted">{g.status}</p>
          </article>
        ))
      )}
    </>
  );
}
