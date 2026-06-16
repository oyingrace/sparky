import { EnokiClient } from "@mysten/enoki";
import { NextRequest, NextResponse } from "next/server";
import { testnetDeployment } from "@/lib/deployments";

const ALLOWED_TARGETS = new Set<string>([
  // Populated after publish — e.g. `${packageId}::goal::create_goal`
]);

function buildAllowedTargets(): Set<string> {
  const pkg = process.env.NEXT_PUBLIC_SPARKY_PACKAGE_ID || testnetDeployment.packageId;
  if (!pkg) return ALLOWED_TARGETS;
  return new Set([
    `${pkg}::goal::create_goal`,
    `${pkg}::goal::submit_proof`,
  ]);
}

/** Enoki sponsored transaction stub — wire Enoki keys to enable gasless txs. */
export async function POST(req: NextRequest) {
  const secretKey = process.env.ENOKI_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "ENOKI_SECRET_KEY not configured" },
      { status: 503 },
    );
  }

  const body = await req.json();
  const allowed = buildAllowedTargets();
  const target = body?.transaction?.commands?.[0]?.MoveCall?.package;
  if (target && allowed.size > 0 && !allowed.has(target)) {
    return NextResponse.json({ error: "Move call not allow-listed" }, { status: 403 });
  }

  const enoki = new EnokiClient({ apiKey: secretKey });
  const sponsored = await enoki.createSponsoredTransaction(body);
  return NextResponse.json(sponsored);
}
