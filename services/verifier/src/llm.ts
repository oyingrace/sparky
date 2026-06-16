export type LlmInput = {
  goalDescription: string;
  proofType: number;
  ruleFlags: string[];
  classifierReasons: string[];
  proofHash: string;
};

export type LlmVerdict = {
  success: boolean;
  confidence: number;
  reasoning: string;
  escalated: true;
};

const ESCALATION_THRESHOLD_FLAGS = [
  "device_id_changed",
  "gps_outside_radius",
  "low_image_entropy",
];

export function shouldEscalate(
  ruleFlags: string[],
  classifierReasons: string[],
  classifierScore: number,
): boolean {
  if (classifierScore < 0.55) return true;
  const allFlags = [...ruleFlags, ...classifierReasons];
  return allFlags.some((f) => ESCALATION_THRESHOLD_FLAGS.includes(f));
}

/** Stage 3: LLM reasoning for ambiguous cases. Falls back to heuristics without API key. */
export async function runLlmEscalation(
  input: LlmInput,
): Promise<LlmVerdict> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      return await callOpenAi(apiKey, input);
    } catch (err) {
      console.error("LLM call failed, using heuristic fallback:", err);
    }
  }

  return heuristicVerdict(input);
}

async function callOpenAi(
  apiKey: string,
  input: LlmInput,
): Promise<LlmVerdict> {
  const prompt = [
    "You are Sparky's AI Game Master. Judge whether proof plausibly satisfies the goal.",
    `Goal context hash/description: ${input.goalDescription}`,
    `Proof type: ${input.proofType}`,
    `Proof SHA-256: ${input.proofHash}`,
    `Rule flags: ${input.ruleFlags.join(", ") || "none"}`,
    `Classifier notes: ${input.classifierReasons.join(", ") || "none"}`,
    'Respond JSON only: {"success":boolean,"confidence":0-1,"reasoning":"..."}',
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as {
    success?: boolean;
    confidence?: number;
    reasoning?: string;
  };

  return {
    success: Boolean(parsed.success),
    confidence: Number(parsed.confidence ?? 0.5),
    reasoning: String(parsed.reasoning ?? "LLM verdict"),
    escalated: true,
  };
}

function heuristicVerdict(input: LlmInput): LlmVerdict {
  const hardFail = input.ruleFlags.some((f) =>
    ["timestamp_after_deadline", "invalid_image_magic", "gps_coordinates_missing"].includes(f),
  );
  if (hardFail) {
    return {
      success: false,
      confidence: 0.85,
      reasoning: "Heuristic: hard rule failure flagged for escalation",
      escalated: true,
    };
  }

  const softFail = input.classifierReasons.includes("very_small_payload");
  return {
    success: !softFail,
    confidence: 0.65,
    reasoning: softFail
      ? "Heuristic: suspicious payload size"
      : "Heuristic: no hard failures in escalated case",
    escalated: true,
  };
}
