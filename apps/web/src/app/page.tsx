"use client";

import { AppNav } from "@/components/AppNav";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <AppNav />
      <main>
        <section className="hero">
          <span className="eyebrow">live on Sui testnet</span>
          <h1 className="hero__title">Put your word on the line.</h1>
          <p className="hero__lead">
            Stake on a goal, prove you hit it, and let others wager on whether
            you will. When the deadline passes, the verifier settles everything
            on-chain.
          </p>
          <div className="hero__actions">
            <Link href="/goals/new" className="primary-btn">
              Create a goal
            </Link>
            <Link href="/markets" className="secondary-btn">
              Browse markets
            </Link>
          </div>
          <p className="hero__meta">Commit → stake → prove → settle</p>
        </section>

        <div className="lanes">
          <article className="lane">
            <span className="lane__phase">Commit</span>
            <div>
              <h2 className="lane__title">Your stake, your deadline</h2>
              <p className="lane__desc">
                Write what you will do, lock test SUI, and choose how you will
                prove it.
              </p>
            </div>
            <Link href="/goals/new">Start →</Link>
          </article>
          <article className="lane">
            <span className="lane__phase">Wager</span>
            <div>
              <h2 className="lane__title">Markets on public goals</h2>
              <p className="lane__desc">
                Bet YES or NO on pari-mutuel pools. Odds shift until the market
                locks.
              </p>
            </div>
            <Link href="/markets">Browse →</Link>
          </article>
          <article className="lane">
            <span className="lane__phase">Settle</span>
            <div>
              <h2 className="lane__title">Honor rate and rewards</h2>
              <p className="lane__desc">
                Track your streak, get alerts before deadlines, and claim pool
                rewards when you miss.
              </p>
            </div>
            <Link href="/profile">Profile →</Link>
          </article>
        </div>

        <p className="footer-link muted">
          <Link href="/dashboard">Founder dashboard</Link>
        </p>
      </main>
    </>
  );
}
