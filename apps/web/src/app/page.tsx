"use client";

import { AppNav } from "@/components/AppNav";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <AppNav />
      <main>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Personal commitment loop</h2>
          <p className="muted">
            Declare a goal, stake test SUI, check in with proof, and let the AI
            verifier settle on-chain.
          </p>
          <Link href="/goals/new" className="primary-btn">
            Create a goal
          </Link>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Prediction markets</h2>
          <p className="muted">
            Bet on public goals with pari-mutuel pools. Implied odds shift until
            lock.
          </p>
          <Link href="/markets" className="primary-btn">
            Browse markets
          </Link>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Social & rewards</h2>
          <p className="muted">
            Track your honor rate and streak, claim Community Pool rewards, and
            get alerts before deadlines.
          </p>
          <Link href="/profile">Profile</Link>
          {" · "}
          <Link href="/notifications">Alerts</Link>
          {" · "}
          <Link href="/pool">Community pool</Link>
        </section>

        <p className="muted" style={{ marginTop: "2rem", fontSize: "0.85rem" }}>
          <Link href="/dashboard">Founder dashboard</Link>
        </p>
      </main>
    </>
  );
}
