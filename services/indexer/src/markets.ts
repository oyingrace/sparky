import type { MarketRecord } from "./store.js";

export type MarketSort = "lock_at" | "liquidity" | "volume";
export type MarketOrder = "asc" | "desc";

export type MarketListOptions = {
  status?: "open" | "locked" | "resolved";
  sort?: MarketSort;
  order?: MarketOrder;
};

export type MarketWithMeta = MarketRecord & {
  liquidityMist: string;
  volumeMist: string;
  impliedOdds: {
    yesToNo: string | null;
    noToYes: string | null;
  };
};

export function listMarketsSorted(
  markets: MarketRecord[],
  options: MarketListOptions = {},
): MarketWithMeta[] {
  let result = markets.map(enrichMarket);

  if (options.status) {
    result = result.filter((m) => m.status === options.status);
  }

  const sort = options.sort ?? "lock_at";
  const order = options.order ?? "asc";
  const dir = order === "asc" ? 1 : -1;

  result.sort((a, b) => {
    if (sort === "lock_at") {
      return dir * (Number(a.lockAt) - Number(b.lockAt));
    }
    if (sort === "liquidity") {
      return dir * (Number(a.liquidityMist) - Number(b.liquidityMist));
    }
    return dir * (Number(a.volumeMist) - Number(b.volumeMist));
  });

  return result;
}

function enrichMarket(m: MarketRecord): MarketWithMeta {
  const yes = BigInt(m.yesPool);
  const no = BigInt(m.noPool);
  const volume = yes + no;
  return {
    ...m,
    liquidityMist: volume.toString(),
    volumeMist: volume.toString(),
    impliedOdds: computeImpliedOdds(m.yesPool, m.noPool),
  };
}

function computeImpliedOdds(yesPool: string, noPool: string) {
  const yes = BigInt(yesPool);
  const no = BigInt(noPool);
  if (yes === 0n && no === 0n) {
    return { yesToNo: null, noToYes: null };
  }
  if (yes === 0n) return { yesToNo: "0", noToYes: null };
  if (no === 0n) return { yesToNo: null, noToYes: "0" };
  return {
    yesToNo: (Number(no * 10000n / yes) / 10000).toFixed(4),
    noToYes: (Number(yes * 10000n / no) / 10000).toFixed(4),
  };
}
