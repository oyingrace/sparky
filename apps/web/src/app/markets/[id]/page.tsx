"use client";

import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CONFIG_ID, PACKAGE_ID } from "@/lib/dapp-kit";

type MarketDetail = {
  market: {
    id: string;
    goalId: string;
    status: string;
    yesPool: string;
    noPool: string;
    lockAt: string;
  };
  impliedOdds?: { yesToNo: string | null; noToYes: string | null };
  disclaimer?: string;
};

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [side, setSide] = useState<"0" | "1">("0");
  const [amountSui, setAmountSui] = useState("0.1");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  useEffect(() => {
    if (!params.id) return;
    fetch(`${indexerUrl}/markets/${params.id}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [indexerUrl, params.id]);

  async function placeBet(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !PACKAGE_ID || !CONFIG_ID || !detail) return;

    setBusy(true);
    setStatus(null);
    try {
      const amountMist = BigInt(Math.floor(parseFloat(amountSui) * 1e9));
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      tx.moveCall({
        target: `${PACKAGE_ID}::market::place_bet`,
        arguments: [
          tx.object(detail.market.id),
          coin,
          tx.pure.u8(Number(side)),
          tx.object("0x6"),
        ],
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Tx failed");
      }
      setStatus(`Bet placed: ${result.Transaction.digest}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Bet failed");
    } finally {
      setBusy(false);
    }
  }

  async function claimWinnings() {
    if (!account || !PACKAGE_ID || !CONFIG_ID || !detail) return;
    setBusy(true);
    setStatus(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::market::claim`,
        arguments: [tx.object(detail.market.id), tx.object(CONFIG_ID)],
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Tx failed");
      }
      setStatus(`Winnings claimed: ${result.Transaction.digest}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return <p className="muted">Loading market…</p>;
  }

  return (
    <>
      <header>
        <div>
          <Link href="/markets" className="muted">
            ← Markets
          </Link>
          <h1 style={{ margin: "0.5rem 0 0" }}>Market</h1>
        </div>
        <ConnectButton />
      </header>

      <section className="card">
        <p className="muted">Status: {detail.market.status}</p>
        <p className="muted">
          YES: {(Number(detail.market.yesPool) / 1e9).toFixed(4)} SUI · NO:{" "}
          {(Number(detail.market.noPool) / 1e9).toFixed(4)} SUI
        </p>
        {detail.impliedOdds?.yesToNo && (
          <p className="muted">Implied YES:NO ≈ 1:{detail.impliedOdds.yesToNo}</p>
        )}
        <p className="muted">{detail.disclaimer}</p>
      </section>

      {detail.market.status === "open" && (
        <form className="card" onSubmit={placeBet}>
          <label htmlFor="side">Side</label>
          <select
            id="side"
            value={side}
            onChange={(e) => setSide(e.target.value as "0" | "1")}
          >
            <option value="0">YES — goal-setter hits it</option>
            <option value="1">NO — they miss</option>
          </select>

          <label htmlFor="amount">Bet amount (SUI)</label>
          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amountSui}
            onChange={(e) => setAmountSui(e.target.value)}
            required
          />

          <button type="submit" className="primary" disabled={busy || !account}>
            {busy ? "Submitting…" : "Place bet"}
          </button>
        </form>
      )}

      {detail.market.status === "resolved" && (
        <section className="card">
          <button
            type="button"
            className="primary"
            disabled={busy || !account}
            onClick={claimWinnings}
          >
            Claim winnings
          </button>
        </section>
      )}

      {status && <p className="muted">{status}</p>}
    </>
  );
}
