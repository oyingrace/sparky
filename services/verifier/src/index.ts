import express from "express";
import { verifyProof } from "./pipeline.js";
import { submitSettlement, type SettleParams } from "./oracle.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.PORT ?? 4001);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    stages: ["rules", "classifier", "llm"],
    llmEnabled: Boolean(process.env.OPENAI_API_KEY),
    oracleSubmitEnabled: Boolean(process.env.ORACLE_PRIVATE_KEY),
  });
});

/** Run staged verification pipeline on proof bytes. */
app.post("/verify", async (req, res) => {
  const {
    proofType = 0,
    proofBase64,
    metadata,
    goalDescription,
    goalDescriptionHash,
  } = req.body ?? {};

  if (!proofBase64) {
    res.status(400).json({ error: "proofBase64 required" });
    return;
  }

  const proofBytes = Buffer.from(proofBase64, "base64");

  try {
    const result = await verifyProof({
      proofType: Number(proofType),
      proofBytes,
      metadata,
      goalDescription,
      goalDescriptionHash,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Verification failed",
    });
  }
});

/** Verify proof and optionally submit on-chain settlement (oracle key required). */
app.post("/verify-and-settle", async (req, res) => {
  const { settle, ...verifyBody } = req.body ?? {};
  if (!proofBase64Present(verifyBody)) {
    res.status(400).json({ error: "proofBase64 required" });
    return;
  }

  const proofBytes = Buffer.from(verifyBody.proofBase64, "base64");
  const result = await verifyProof({
    proofType: Number(verifyBody.proofType ?? 0),
    proofBytes,
    metadata: verifyBody.metadata,
    goalDescription: verifyBody.goalDescription,
    goalDescriptionHash: verifyBody.goalDescriptionHash,
  });

  let settlement = null;
  if (settle && typeof settle === "object") {
    settlement = await submitSettlement(settle as SettleParams);
  }

  res.json({ ...result, settlement });
});

function proofBase64Present(body: Record<string, unknown>): boolean {
  return typeof body.proofBase64 === "string" && body.proofBase64.length > 0;
}

app.listen(PORT, () => {
  console.log(`Sparky verifier worker listening on :${PORT}`);
});
