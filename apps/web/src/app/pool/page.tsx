"use client";

import { AppNav } from "@/components/AppNav";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useState } from "react";
import { COMMUNITY_POOL_ID, PACKAGE_ID } from "@/lib/dapp-kit";

type EpochInfo = {
  epochId: number;
  forfeitedTotal: string;
  shares: { address: string; amount: string }[];
};

export default function PoolClaimPage() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [epoch, setEpoch] = useState<EpochInfo | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

  useEffect(() => {
    fetch(`${indexerUrl}/epochs/current`)
      .then((r) => r.json())
      .then(setEpoch)
      .catch(() => setEpoch(null));
  }, [indexerUrl]);

  const myShare = epoch?.shares.find(
    (s) => account && s.address.toLowerCase() === account.address.toLowerCase(),
  );

  async function claimReward() {
    if (!account || !PACKAGE_ID || !COMMUNITY_POOL_ID) return;
    setBusy(true);
    setStatus(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::community_pool::claim`,
        arguments: [tx.object(COMMUNITY_POOL_ID)],
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Tx failed");
      }
      setStatus(`Reward claimed: ${result.Transaction.digest}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppNav />
      <main>
        <h1 style={{ marginTop: 0 }}>Community Pool</h1>

        <section className="card">
        <p className="muted">
          Epoch {epoch?.epochId ?? "—"} · Forfeited pool:{" "}
          {epoch ? (Number(epoch.forfeitedTotal) / 1e9).toFixed(4) : "0"} SUI
        </p>
        {myShare ? (
          <p>
            Your share: {(Number(myShare.amount) / 1e9).toFixed(4)} SUI
          </p>
        ) : (
          <p className="muted">
            No published claim for your address this epoch yet.
          </p>
        )}
        <button
          type="button"
          className="primary"
          disabled={busy || !account || !myShare}
          onClick={claimReward}
        >
          {busy ? "Claiming…" : "Claim epoch reward"}
        </button>
        {status && <p className="muted">{status}</p>}
        </section>
      </main>
    </>
  );
}
