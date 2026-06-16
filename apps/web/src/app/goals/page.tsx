"use client";

import { AppNav } from "@/components/AppNav";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
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
        <PageHeader
          eyebrow="Commit"
          title="Goals"
          lead="Public goals indexed from testnet. Check in before your deadline to keep your stake."
          action={
            <Link href="/goals/new" className="primary-btn">
              New goal
            </Link>
          }
        />

        {goals.length === 0 ? (
          <EmptyState
            title="No goals yet"
            body="Create your first commitment and stake test SUI to get started."
            actionLabel="Create a goal"
            actionHref="/goals/new"
          />
        ) : (
          goals.map((g) => (
            <article
              key={g.id}
              className={`ledger ${g.status.includes("success") ? "ledger--settled" : g.status.includes("fail") ? "ledger--warn" : ""}`}
            >
              <div className="ledger__inner">
                <p className="mono" style={{ margin: "0 0 0.5rem" }}>
                  {g.id.slice(0, 16)}…
                </p>
                <StatusPill status={g.status} />
                {g.status === "active" && (
                  <p style={{ marginTop: "0.75rem" }}>
                    <Link href={`/goals/${g.id}/check-in`}>Check in</Link>
                  </p>
                )}
              </div>
            </article>
          ))
        )}
      </main>
    </>
  );
}
