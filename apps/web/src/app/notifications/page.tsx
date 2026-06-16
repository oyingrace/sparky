"use client";

import { AppNav } from "@/components/AppNav";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
  priority: "high" | "normal" | "low";
};

export default function NotificationsPage() {
  const account = useCurrentAccount();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  useEffect(() => {
    if (!account?.address) return;
    fetch(
      `${indexerUrl}/notifications?address=${encodeURIComponent(account.address)}`,
    )
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => setNotifications([]));
  }, [account?.address, indexerUrl]);

  return (
    <>
      <AppNav />
      <main>
        <PageHeader
          eyebrow="Settle"
          title="Alerts"
          lead="Deadlines, market locks, settlement results, and claimable rewards."
        />

        {!account ? (
          <EmptyState
            title="Connect to see alerts"
            body="Sign in to get reminders before check-ins close and markets lock."
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            title="Nothing to act on"
            body="When a deadline approaches or a market resolves, alerts will show here."
            actionLabel="Browse markets"
            actionHref="/markets"
          />
        ) : (
          notifications.map((n) => (
            <article
              key={n.id}
              className={`ledger notification-${n.priority}`}
            >
              <div className="ledger__inner">
                <strong>{n.title}</strong>
                <p className="muted">{n.body}</p>
                {n.href && <Link href={n.href}>Take action</Link>}
              </div>
            </article>
          ))
        )}
      </main>
    </>
  );
}
