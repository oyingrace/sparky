"use client";

import { AppNav } from "@/components/AppNav";
import { PageHeader } from "@/components/PageHeader";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import {
  COMMUNITY_POOL_ID,
  CONFIG_ID,
  PACKAGE_ID,
} from "@/lib/dapp-kit";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): number[] {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return pairs.map((p) => parseInt(p, 16));
}

export default function NewGoalPage() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [description, setDescription] = useState("");
  const [stakeSui, setStakeSui] = useState("0.1");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [isPublic, setIsPublic] = useState(false);
  const [proofType, setProofType] = useState("0");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !PACKAGE_ID || !CONFIG_ID) {
      setStatus("Publish contracts and set deployment IDs before creating goals.");
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const descriptionHash = await sha256Hex(description);
      const stakeMist = BigInt(Math.floor(parseFloat(stakeSui) * 1e9));
      const deadline = BigInt(
        Date.now() + Number(deadlineDays) * 86_400_000,
      );

      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [stakeMist]);
      tx.moveCall({
        target: `${PACKAGE_ID}::goal::create_goal`,
        arguments: [
          tx.object(CONFIG_ID),
          coin,
          tx.pure.vector("u8", hexToBytes(descriptionHash)),
          tx.pure.u8(Number(proofType)),
          tx.pure.u64(deadline),
          tx.pure.bool(isPublic),
          tx.object("0x6"),
        ],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }
      setStatus(`Goal created: ${result.Transaction.digest}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create goal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppNav />
      <main>
        <PageHeader
          eyebrow="Commit"
          title="New goal"
          lead="Describe what you will do, stake test SUI, and set a deadline. Public goals open a prediction market."
        />

        <form className="ledger" onSubmit={handleCreate}>
          <div className="ledger__inner">
            <div className="form-section">
              <p className="form-section__label">What you will do</p>
              <label htmlFor="description">Goal description</label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Run 5k before Friday"
                required
              />
            </div>

            <div className="form-section">
              <p className="form-section__label">Proof and visibility</p>
              <label htmlFor="proofType">How you will prove it</label>
              <select
                id="proofType"
                value={proofType}
                onChange={(e) => setProofType(e.target.value)}
              >
                <option value="0">Photo</option>
                <option value="1">GPS</option>
                <option value="2">Webhook (stub)</option>
              </select>

              <label htmlFor="public">Market visibility</label>
              <select
                id="public"
                value={isPublic ? "1" : "0"}
                onChange={(e) => setIsPublic(e.target.value === "1")}
              >
                <option value="0">Private — no market</option>
                <option value="1">Public — opens a market</option>
              </select>
            </div>

            <div className="form-section">
              <p className="form-section__label">Stake and deadline</p>
              <label htmlFor="stake">Stake amount (test SUI)</label>
              <input
                id="stake"
                type="number"
                min="0.1"
                step="0.01"
                value={stakeSui}
                onChange={(e) => setStakeSui(e.target.value)}
                required
              />

              <label htmlFor="deadline">Deadline (days from today)</label>
              <input
                id="deadline"
                type="number"
                min="2"
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(e.target.value)}
                required
              />
            </div>

            {!PACKAGE_ID && (
              <p className="muted">
                Publish the Move package and fill{" "}
                <code>deployments/testnet.json</code> first.
              </p>
            )}

            <button type="submit" className="primary" disabled={busy || !account}>
              {busy ? "Creating…" : "Create goal and stake"}
            </button>
            {status && <p className="status-msg">{status}</p>}
          </div>
        </form>

        {!COMMUNITY_POOL_ID && (
          <p className="muted" style={{ marginTop: "1rem" }}>
            Community pool ID not configured yet.
          </p>
        )}
      </main>
    </>
  );
}
