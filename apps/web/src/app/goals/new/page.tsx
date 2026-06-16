"use client";

import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import Link from "next/link";
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
      setStatus("Deploy contracts and set env vars before creating goals.");
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
          tx.object("0x6"), // Clock shared object
        ],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Tx failed");
      }
      setStatus(`Goal created: ${result.Transaction.digest}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <div>
          <Link href="/goals" className="muted">
            ← Goals
          </Link>
          <h1 style={{ margin: "0.5rem 0 0" }}>New goal</h1>
        </div>
        <ConnectButton />
      </header>

      <form className="card" onSubmit={handleCreate}>
        <label htmlFor="description">Goal description</label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Run 5k before Friday…"
          required
        />

        <label htmlFor="proofType">Proof type</label>
        <select
          id="proofType"
          value={proofType}
          onChange={(e) => setProofType(e.target.value)}
        >
          <option value="0">Photo</option>
          <option value="1">GPS</option>
          <option value="2">Webhook (stub)</option>
        </select>

        <label htmlFor="public">Make public (opens a prediction market)</label>
        <select
          id="public"
          value={isPublic ? "1" : "0"}
          onChange={(e) => setIsPublic(e.target.value === "1")}
        >
          <option value="0">Private</option>
          <option value="1">Public</option>
        </select>

        <label htmlFor="stake">Stake (SUI, testnet)</label>
        <input
          id="stake"
          type="number"
          min="0.1"
          step="0.01"
          value={stakeSui}
          onChange={(e) => setStakeSui(e.target.value)}
          required
        />

        <label htmlFor="deadline">Deadline (days from now)</label>
        <input
          id="deadline"
          type="number"
          min="2"
          value={deadlineDays}
          onChange={(e) => setDeadlineDays(e.target.value)}
          required
        />

        {!PACKAGE_ID && (
          <p className="muted">
            Publish the Move package and fill{" "}
            <code>deployments/testnet.json</code> first.
          </p>
        )}

        <button type="submit" className="primary" disabled={busy || !account}>
          {busy ? "Creating…" : "Create goal & stake"}
        </button>
        {status && <p className="muted">{status}</p>}
      </form>

      {COMMUNITY_POOL_ID ? null : (
        <p className="muted">Community pool ID not configured yet.</p>
      )}
    </>
  );
}
