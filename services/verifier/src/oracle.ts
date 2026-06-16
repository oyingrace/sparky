/**
 * Oracle sign-and-submit boundary — swappable for Nautilus TEE later.
 * When ORACLE_PRIVATE_KEY is set, submits settle_goal + resolve_market PTBs.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import {
  getJsonRpcFullnodeUrl,
  SuiJsonRpcClient,
} from "@mysten/sui/jsonRpc";

export type SettleParams = {
  packageId: string;
  goalId: string;
  commitmentId: string;
  configId: string;
  communityPoolId: string;
  marketId?: string;
  success: boolean;
  proofHashHex: string;
};

export type SettleResult = {
  submitted: boolean;
  digest?: string;
  note?: string;
};

function hexToBytes(hex: string): number[] {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return pairs.map((p) => parseInt(p, 16));
}

export async function submitSettlement(
  params: SettleParams,
): Promise<SettleResult> {
  const secret = process.env.ORACLE_PRIVATE_KEY;
  if (!secret) {
    return {
      submitted: false,
      note: "ORACLE_PRIVATE_KEY not configured — verdict computed only",
    };
  }

  const keypair = Ed25519Keypair.fromSecretKey(secret);
  const client = new SuiJsonRpcClient({
    network: "testnet",
    url: process.env.SUI_RPC_URL ?? getJsonRpcFullnodeUrl("testnet"),
  });

  const tx = new Transaction();
  tx.moveCall({
    target: `${params.packageId}::goal::settle_goal`,
    arguments: [
      tx.object(process.env.ORACLE_CAP_ID ?? ""),
      tx.object(params.goalId),
      tx.object(params.commitmentId),
      tx.object(params.communityPoolId),
      tx.pure.bool(params.success),
    ],
  });

  if (params.marketId) {
    tx.moveCall({
      target: `${params.packageId}::market::lock`,
      arguments: [tx.object(params.marketId), tx.object("0x6")],
    });
    tx.moveCall({
      target: `${params.packageId}::market::resolve`,
      arguments: [
        tx.object(process.env.ORACLE_CAP_ID ?? ""),
        tx.object(params.marketId),
        tx.pure.bool(params.success),
      ],
    });
  }

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
  });

  return {
    submitted: true,
    digest: result.digest,
  };
}

export function proofHashBytes(hex: string): number[] {
  return hexToBytes(hex.padStart(64, "0").slice(0, 64));
}
