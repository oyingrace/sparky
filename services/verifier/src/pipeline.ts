import { runClassifier } from "./classifier.js";
import { runLlmEscalation, shouldEscalate } from "./llm.js";
import { runRuleChecks, type RuleCheckInput } from "./rules.js";
import { createHash } from "node:crypto";

export type VerifyInput = RuleCheckInput & {
  goalDescription?: string;
  goalDescriptionHash?: string;
};

export type VerifyResult = {
  success: boolean;
  proofHash: string;
  stage: "rules" | "classifier" | "llm";
  flags: string[];
  confidence: number;
  reasoning?: string;
  escalatedToLlm: boolean;
};

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function verifyProof(input: VerifyInput): Promise<VerifyResult> {
  const proofHash = sha256(input.proofBytes);

  const rules = runRuleChecks(input);
  if (!rules.passed) {
    const hardBlock = rules.flags.some((f) =>
      ["timestamp_after_deadline", "invalid_image_magic", "proof_too_small"].includes(f),
    );
    if (hardBlock) {
      return {
        success: false,
        proofHash,
        stage: "rules",
        flags: rules.flags,
        confidence: 0.95,
        reasoning: "Failed deterministic rule checks",
        escalatedToLlm: false,
      };
    }
  }

  const classifier = runClassifier({
    proofBytes: input.proofBytes,
    goalDescriptionHash: input.goalDescriptionHash ?? "",
    proofType: input.proofType,
  });

  const escalate =
    shouldEscalate(rules.flags, classifier.reasons, classifier.score) ||
    (!classifier.passed && classifier.suspicious);

  if (!escalate) {
    return {
      success: classifier.passed,
      proofHash,
      stage: "classifier",
      flags: [...rules.flags, ...classifier.reasons],
      confidence: classifier.score,
      reasoning: "Passed rules and classifier without LLM",
      escalatedToLlm: false,
    };
  }

  const llm = await runLlmEscalation({
    goalDescription: input.goalDescription ?? input.goalDescriptionHash ?? "",
    proofType: input.proofType,
    ruleFlags: rules.flags,
    classifierReasons: classifier.reasons,
    proofHash,
  });

  return {
    success: llm.success,
    proofHash,
    stage: "llm",
    flags: [...rules.flags, ...classifier.reasons],
    confidence: llm.confidence,
    reasoning: llm.reasoning,
    escalatedToLlm: true,
  };
}
