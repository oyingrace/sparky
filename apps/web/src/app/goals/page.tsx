"use client";

import { AppNav } from "@/components/AppNav";
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
      <AppNav />
      <main>
        <div className="card-row" style={{ marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Goals</h1>
          <Link href="/goals/new" className="primary-btn">
            New goal
          </Link>
        </div>

        {goals.length === 0 ? (
          <p className="muted">No indexed goals yet.</p>
        ) : (
          goals.map((g) => (
            <article key={g.id} className="card">
              <strong>{g.id.slice(0, 16)}…</strong>
              <p className="muted">{g.status}</p>
              {g.status === "active" && (
                <Link href={`/goals/${g.id}/check-in`}>Check in →</Link>
              )}
            </article>
          ))
        )}
      </main>
    </>
  );
}
