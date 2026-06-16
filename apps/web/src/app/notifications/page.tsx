"use client";

import { AppNav } from "@/components/AppNav";
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
        <h1 style={{ marginTop: 0 }}>Alerts</h1>
        <p className="muted">
          Check-in reminders, market lock warnings, settlement results, and
          claimable rewards. Push/email hooks can subscribe to these events
          later.
        </p>

        {!account ? (
          <p className="muted">Connect wallet to see your alerts.</p>
        ) : notifications.length === 0 ? (
          <p className="muted">Nothing to act on right now.</p>
        ) : (
          notifications.map((n) => (
            <article
              key={n.id}
              className={`card notification-${n.priority}`}
            >
              <strong>{n.title}</strong>
              <p className="muted">{n.body}</p>
              {n.href && <Link href={n.href}>Take action →</Link>}
            </article>
          ))
        )}
      </main>
    </>
  );
}
