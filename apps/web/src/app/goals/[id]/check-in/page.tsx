"use client";

import { AppNav } from "@/components/AppNav";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PACKAGE_ID } from "@/lib/dapp-kit";

type GoalDetail = {
  goal: {
    id: string;
    owner: string;
    status: string;
    proofType: number;
    descriptionHash: string;
  };
};

export default function CheckInPage() {
  const params = useParams<{ id: string }>();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [goal, setGoal] = useState<GoalDetail["goal"] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const indexerUrl =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";
  const verifierUrl =
    process.env.NEXT_PUBLIC_VERIFIER_URL ?? "http://localhost:4001";

  useEffect(() => {
    if (!params.id) return;
    fetch(`${indexerUrl}/goals/${params.id}`)
      .then((r) => r.json())
      .then((data: GoalDetail) => setGoal(data.goal))
      .catch(() => setGoal(null));
  }, [indexerUrl, params.id]);

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !goal || !file || !PACKAGE_ID) return;

    setBusy(true);
    setStatus(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const proofBase64 = arrayBufferToBase64(arrayBuffer);

      const verifyRes = await fetch(`${verifierUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofType: goal.proofType,
          proofBase64,
          goalDescriptionHash: goal.descriptionHash,
          metadata: { submittedAtMs: Date.now() },
        }),
      });
      const verdict = await verifyRes.json();

      if (!verdict.success) {
        setStatus(
          `Verifier rejected (${verdict.stage}): ${verdict.reasoning ?? verdict.flags?.join(", ")}`,
        );
        return;
      }

      const proofHashHex = verdict.proofHash as string;
      const proofHashBytes = hexToBytes(proofHashHex);

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::goal::submit_proof`,
        arguments: [
          tx.object(goal.id),
          tx.pure.vector("u8", proofHashBytes),
          tx.object("0x6"),
        ],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Tx failed");
      }

      setStatus(
        `Proof submitted (${verdict.stage}, confidence ${verdict.confidence}). Tx: ${result.Transaction.digest}`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppNav />
      <main>
        <h1 style={{ marginTop: 0 }}>Check in</h1>

        {!goal ? (
          <p className="muted">Loading goal…</p>
        ) : (
          <section className="card">
        <p className="muted">Status: {goal.status}</p>
        <form onSubmit={handleCheckIn}>
          <label htmlFor="proof">Proof upload</label>
          <input
            id="proof"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          <button type="submit" className="primary" disabled={busy || !account}>
            {busy ? "Verifying…" : "Verify & submit proof"}
          </button>
        </form>
            {status && <p className="muted">{status}</p>}
          </section>
        )}
      </main>
    </>
  );
}

function hexToBytes(hex: string): number[] {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return pairs.map((p) => parseInt(p, 16));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
