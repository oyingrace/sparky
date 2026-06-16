"use client";

import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <header>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Sparky</h1>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Commit → stake → prove → settle (Sui Testnet)
          </p>
        </div>
        <ConnectButton />
      </header>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Personal commitment loop</h2>
        <p className="muted">
          Phase 1: create a goal, stake test SUI, check in with proof, and let
          the AI verifier settle on-chain.
        </p>
        <Link href="/goals/new">
          <button type="button" className="primary">
            Create a goal
          </button>
        </Link>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Your goals</h2>
        <p className="muted">
          Goal history is served by the indexer once deployed. Connect wallet
          and publish contracts to exercise the full loop.
        </p>
        <Link href="/goals">View goals →</Link>
      </section>
    </>
  );
}
