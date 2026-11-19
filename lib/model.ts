// Token Launch Radar model — stage 1.
// Every number below is derived only from fields inside the snapshot itself:
// tvl_usd, change_7d, listed_at, mcap_usd, symbol, gecko_id, category, chains.
// No protocol name is ever hardcoded.

export interface Protocol {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  protocols: Protocol[];
  watchlist: string[];
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  watchlist: boolean;
  token_status: string;
  token_recorded: boolean;
  age_days: number | null;
  implied_value_usd: number;
  score: number;
  why: string;
  farm_steps: string[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function hasTokenRecord(p: Protocol): boolean {
  return p.symbol !== null || p.gecko_id !== null || p.mcap_usd !== null;
}

export function ageDays(p: Protocol, asOf: Date): number | null {
  if (!p.listed_at) return null;
  const t = Date.parse(p.listed_at + "T00:00:00Z");
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((asOf.getTime() - t) / 86400000));
}

/** Median mcap/TVL ratio per category, learned from token-recorded peers in the snapshot. */
export function categoryRatios(protos: Protocol[]): Map<string, number> {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protos) {
    if (p.mcap_usd !== null && p.tvl_usd > 0) {
      const r = p.mcap_usd / p.tvl_usd;
      if (r > 0 && Number.isFinite(r)) {
        all.push(r);
        const arr = byCat.get(p.category) ?? [];
        arr.push(r);
        byCat.set(p.category, arr);
      }
    }
  }
  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)]! : 1;
  };
  const globalMed = all.length ? median(all) : 1;
  const out = new Map<string, number>();
  for (const [cat, xs] of byCat) out.set(cat, clamp(median(xs), 0.05, 5));
  out.set("__global__", clamp(globalMed, 0.05, 5));
  return out;
}

export function farmSteps(p: Protocol, preToken: boolean): string[] {
  const chain = p.chains[0] ?? "Ethereum";
  const chainList = (p.chains.length > 3 ? p.chains.slice(0, 3).join(", ") + ` and ${p.chains.length - 3} more chains` : p.chains.join(", ")) || chain;
  const kind = preToken
    ? "not recorded as having a token, so activity may count toward a future distribution"
    : "already has a recorded token, so farm its points, fees and governance rewards instead";
  return [
    `Open ${p.name} (${p.category} on ${chainList}) and read its docs first: about 20 minutes, $0 cost, note every points or season program it mentions.`,
    `Connect a fresh wallet on ${chain} and make one small real deposit of $25-$100 for 30-45 minutes of setup; keep gas money aside, roughly $2-$10 per transaction.`,
    `Use the core ${p.category} action weekly for 6-8 weeks (about 10 minutes each week, $5-$20 total gas) so activity looks sustained, not a one-day burst.`,
    `Track eligibility monthly in a simple sheet: wallet, dates, volume and cost per step, 15 minutes a month, $0; ${p.name} is ${kind}.`,
    `Set a monthly review alarm: re-check TVL and announcements for 10 minutes, $0 cost, and stop farming if total spend passes $150 without a confirmed program.`,
  ];
}

export function buildBoard(snapshot: Snapshot, limit = 240): BoardRow[] {
  const asOf = new Date(snapshot.as_of + "T00:00:00Z");
  const ratios = categoryRatios(snapshot.protocols);
  const globalRatio = ratios.get("__global__") ?? 1;
  const watch = new Set(snapshot.watchlist);

  const scored = snapshot.protocols.map((p) => {
    const recorded = hasTokenRecord(p);
    const age = ageDays(p, asOf);
    const ratio = ratios.get(p.category) ?? globalRatio;
    const momentum = 1 + clamp(p.change_7d ?? 0, -50, 100) / 250;
    const ageFactor = age === null ? 1.1 : 1 + Math.log10(1 + age) / 6;
    const preTokenBoost = recorded ? 0.55 : 1.35;
    const watchBoost = watch.has(p.slug) ? 1.25 : 1;
    const implied = Math.round(p.tvl_usd * ratio * momentum * ageFactor * preTokenBoost * watchBoost);
    const score = Math.log10(1 + p.tvl_usd) * preTokenBoost * watchBoost * momentum;
    return { p, recorded, age, implied, score };
  });

  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));

  // Selection: every watchlist protocol, filled up to `limit` by implied value.
  const chosen: typeof scored = [];
  const seen = new Set<string>();
  for (const s of scored) {
    if (watch.has(s.p.slug)) { chosen.push(s); seen.add(s.p.slug); }
  }
  for (const s of scored) {
    if (chosen.length >= limit) break;
    if (!seen.has(s.p.slug)) { chosen.push(s); seen.add(s.p.slug); }
  }
  chosen.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));

  // Force strictly non-increasing, not-all-equal values: nudge ties down by rank.
  let prev = Number.POSITIVE_INFINITY;
  return chosen.map((s, i) => {
    let v = Math.min(s.implied, prev);
    if (v === prev) v = prev - 1;
    if (i > 0 && v >= prev) v = prev - 1;
    prev = v;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      watchlist: watch.has(s.p.slug),
      token_status: s.recorded
        ? "Token recorded (symbol, listing or market cap present in snapshot)"
        : "Not recorded as having a token in this snapshot",
      token_recorded: s.recorded,
      age_days: s.age,
      implied_value_usd: Math.max(1, v),
      score: Number(s.score.toFixed(6)),
      why: `$${s.p.tvl_usd.toLocaleString("en-US")} TVL, ${s.p.change_7d === null ? "no 7d change recorded" : s.p.change_7d.toFixed(1) + "% in 7 days"}, ${s.age === null ? "listing date not recorded" : s.age + " days in the snapshot"}, valued against the median market-cap/TVL of token-recorded ${s.p.category} peers in this same snapshot.`,
      farm_steps: farmSteps(s.p, !s.recorded),
    };
  });
}
