"use client";

import { AppNav } from "@/components/AppNav";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
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
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
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
        <PageHeader
          eyebrow="Settle"
          title="Community pool"
          lead="When goals are missed, forfeited stakes feed the pool. Honored users share rewards each epoch."
        />

        <section className="ledger ledger--settled">
          <div className="ledger__inner">
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-label">Current epoch</div>
                <div className="stat-value">{epoch?.epochId ?? "—"}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Forfeited pool</div>
                <div className="stat-value stat-value--mono">
                  {epoch
                    ? `${(Number(epoch.forfeitedTotal) / 1e9).toFixed(4)} SUI`
                    : "—"}
                </div>
              </div>
            </div>

            {!account ? (
              <EmptyState
                title="Connect to claim"
                body="Sign in to see if you have a published reward for this epoch."
              />
            ) : myShare ? (
              <>
                <p style={{ margin: "1.25rem 0" }}>
                  Your share:{" "}
                  <span className="mono">
                    {(Number(myShare.amount) / 1e9).toFixed(4)} SUI
                  </span>
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={claimReward}
                >
                  {busy ? "Claiming…" : "Claim epoch reward"}
                </button>
              </>
            ) : (
              <p className="muted" style={{ marginTop: "1.25rem" }}>
                No published claim for your address this epoch.
              </p>
            )}
            {status && <p className="status-msg">{status}</p>}
          </div>
        </section>
      </main>
    </>
  );
}
