"use client";

import { AppNav } from "@/components/AppNav";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";

type FraudFlag = {
  id: string;
  type: string;
  severity: string;
  bettor: string;
  goalOwner: string;
  detail: string;
};

export default function FraudPage() {
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  useEffect(() => {
    fetch(`${indexerUrl}/fraud/flags`)
      .then((r) => r.json())
      .then((data) => setFlags(data.flags ?? []))
      .catch(() => setFlags([]));
  }, [indexerUrl]);

  return (
    <>
      <AppNav />
      <main>
        <PageHeader
          eyebrow="Internal"
          title="Integrity flags"
          lead="Suspicious betting patterns flagged by the indexer."
          action={
            <Link href="/dashboard" className="secondary-btn">
              Dashboard
            </Link>
          }
        />

        {flags.length === 0 ? (
          <EmptyState
            title="No flags"
            body="When collusion or heavy-bet patterns are detected, they will appear here."
          />
        ) : (
          flags.map((f) => (
            <article key={f.id} className="ledger ledger--warn">
              <div className="ledger__inner">
                <span className="pill pill--locked">{f.severity}</span>
                <strong style={{ display: "block", marginTop: "0.5rem" }}>
                  {f.type}
                </strong>
                <p className="muted">{f.detail}</p>
                <p className="mono muted">
                  Bettor {f.bettor.slice(0, 10)}… · Owner{" "}
                  {f.goalOwner.slice(0, 10)}…
                </p>
              </div>
            </article>
          ))
        )}
      </main>
    </>
  );
}
