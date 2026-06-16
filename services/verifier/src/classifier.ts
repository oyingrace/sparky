export type ClassifierInput = {
  proofBytes: Buffer;
  goalDescriptionHash: string;
  proofType: number;
};

export type ClassifierResult = {
  score: number;
  passed: boolean;
  suspicious: boolean;
  reasons: string[];
};

/** Stage 2: lightweight content sanity check (no ML model in MVP). */
export function runClassifier(input: ClassifierInput): ClassifierResult {
  const reasons: string[] = [];
  let score = 1.0;

  if (input.proofBytes.length < 256) {
    score -= 0.4;
    reasons.push("very_small_payload");
  }

  if (input.proofType === 0) {
    const entropy = estimateEntropy(input.proofBytes.subarray(0, 512));
    if (entropy < 3.5) {
      score -= 0.3;
      reasons.push("low_image_entropy");
    }
  }

  if (!input.goalDescriptionHash || input.goalDescriptionHash.length < 8) {
    score -= 0.1;
    reasons.push("missing_goal_context");
  }

  score = Math.max(0, Math.min(1, score));
  const suspicious = score < 0.6 || reasons.length > 0;
  const passed = score >= 0.5;

  return { score, passed, suspicious, reasons };
}

function estimateEntropy(bytes: Buffer): number {
  if (bytes.length === 0) return 0;
  const freq = new Map<number, number>();
  for (const b of bytes) {
    freq.set(b, (freq.get(b) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
