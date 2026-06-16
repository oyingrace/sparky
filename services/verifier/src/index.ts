import express from "express";
import { createHash } from "node:crypto";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.PORT ?? 4001);

export type RuleCheckResult = {
  passed: boolean;
  flags: string[];
};

/** Stage 1: deterministic rule checks (EXIF, GPS, timestamp, device). */
export function runRuleChecks(_payload: {
  proofType: number;
  proofBytes: Buffer;
  metadata?: Record<string, unknown>;
}): RuleCheckResult {
  // Phase 1 stub — always pass; Phase 3 adds real checks.
  return { passed: true, flags: [] };
}

/** Stage 2: lightweight classifier stub. */
export function runClassifier(_payload: {
  proofBytes: Buffer;
  goalDescriptionHash: string;
}): { score: number; passed: boolean } {
  return { score: 1.0, passed: true };
}

/** Stage 3: LLM escalation stub (Phase 3). */
export function runLlmEscalation(_payload: unknown): null {
  return null;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, stages: ["rules", "classifier", "llm-stub"] });
});

/** Accept proof bytes, run staged pipeline, return verdict + hash for on-chain submission. */
app.post("/verify", (req, res) => {
  const { proofType = 0, proofBase64, metadata } = req.body ?? {};
  if (!proofBase64) {
    res.status(400).json({ error: "proofBase64 required" });
    return;
  }

  const proofBytes = Buffer.from(proofBase64, "base64");
  const proofHash = sha256(proofBytes);

  const rules = runRuleChecks({ proofType, proofBytes, metadata });
  if (!rules.passed) {
    res.json({ success: false, proofHash, stage: "rules", flags: rules.flags });
    return;
  }

  const classifier = runClassifier({
    proofBytes,
    goalDescriptionHash: metadata?.descriptionHash ?? "",
  });

  const success = classifier.passed;
  res.json({
    success,
    proofHash,
    stage: "classifier",
    escalateToLlm: false,
    note: "LLM escalation stubbed for Phase 1",
  });
});

app.listen(PORT, () => {
  console.log(`Sparky verifier worker listening on :${PORT}`);
});
