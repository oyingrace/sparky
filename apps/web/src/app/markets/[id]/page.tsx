"use client";

import { AppNav } from "@/components/AppNav";
import { OddsLine } from "@/components/OddsLine";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
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
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
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
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }
      setStatus(`Winnings claimed: ${result.Transaction.digest}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <>
        <AppNav />
        <main>
          <p className="muted">Loading market…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main>
        <PageHeader
          eyebrow="Wager"
          title="Market detail"
          lead={detail.disclaimer}
        />

        <section
          className={`ledger ${detail.market.status === "resolved" ? "ledger--settled" : detail.market.status === "locked" ? "ledger--warn" : ""}`}
        >
          <div className="ledger__inner">
            <StatusPill status={detail.market.status} />
            <p className="mono" style={{ margin: "0.75rem 0" }}>
              Goal {detail.market.goalId.slice(0, 10)}…
            </p>
            <OddsLine
              yesPool={detail.market.yesPool}
              noPool={detail.market.noPool}
              yesToNo={detail.impliedOdds?.yesToNo}
            />
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              Locks {new Date(Number(detail.market.lockAt)).toLocaleString()}
            </p>
          </div>
        </section>

        {detail.market.status === "open" && (
          <form className="ledger" onSubmit={placeBet}>
            <div className="ledger__inner">
              <p className="form-section__label">Place a bet</p>
              <label htmlFor="side">Your side</label>
              <select
                id="side"
                value={side}
                onChange={(e) => setSide(e.target.value as "0" | "1")}
              >
                <option value="0">YES — goal-setter hits it</option>
                <option value="1">NO — they miss</option>
              </select>

              <label htmlFor="amount">Bet amount (test SUI)</label>
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
            </div>
          </form>
        )}

        {detail.market.status === "resolved" && (
          <section className="ledger ledger--settled">
            <div className="ledger__inner">
              <button
                type="button"
                className="primary"
                disabled={busy || !account}
                onClick={claimWinnings}
              >
                {busy ? "Claiming…" : "Claim winnings"}
              </button>
            </div>
          </section>
        )}

        {status && <p className="status-msg">{status}</p>}
      </main>
    </>
  );
}
