"use client";

import { AppNav } from "@/components/AppNav";
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
        <Link href="/dashboard" className="muted">
          ← Dashboard
        </Link>
        <h1 style={{ margin: "0.5rem 0 0" }}>Integrity flags</h1>
        {flags.length === 0 ? (
          <p className="muted">No suspicious patterns flagged yet.</p>
        ) : (
          flags.map((f) => (
            <article key={f.id} className="card">
              <span className="badge badge-warn">{f.severity}</span>{" "}
              <strong>{f.type}</strong>
              <p className="muted">{f.detail}</p>
              <p className="muted">
                Bettor {f.bettor.slice(0, 10)}… · Owner{" "}
                {f.goalOwner.slice(0, 10)}…
              </p>
            </article>
          ))
        )}
      </main>
    </>
  );
}
