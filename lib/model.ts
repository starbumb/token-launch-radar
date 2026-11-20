// The token launch radar's model: one sealed snapshot in, one ranked board out.
//
// The board ranks every protocol in the snapshot that records no token and is not a wrapped, staked or
// bridged product of one that trades. That set is the snapshot's watchlist (the floor, never a ceiling)
// plus every smaller protocol that passes the same visible tests the watchlist rule states: no token on
// record, a category that is not Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked
// BTC or CEX, no wrapped/staked/staking word in the name, no exchange-name prefix, no version marker.
//
// Implied value is this entry's own claim about what a token would be worth if the protocol's record
// stayed as it is. It follows only from the snapshot's own figures:
//
//   multiple   = the median market-cap-to-TVL ratio of the live-token protocols in the protocol's own
//                category (at least 5 of them, else the global median over every live protocol with
//                both figures), clamped to [0.5x, 2x] of the global median
//   growth     = clamp(change_7d, -60, 120) per cent;  growth_mult = 1 + growth/100 x 0.5
//   maturity   = 0.6 + min(age_days, 1095)/1095 x 0.4  (age unknown: 365 days)
//   implied    = max(1, round(tvl_usd x multiple x growth_mult x maturity_mult))
//
// No protocol name is ever special-cased: one function scores every row, and the multiples are measured
// on the snapshot at run time, never typed in. Live-token protocols are kept apart with the market's
// own values, never mixed into the ranked board.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's fixed constants. The multiples themselves are measured on the snapshot, not listed here. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  min_category_samples: number;
  multiple_clamp_low: number;
  multiple_clamp_high: number;
  fallback_multiple: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  min_category_samples: 5,
  multiple_clamp_low: 0.5,
  multiple_clamp_high: 2,
  fallback_multiple: 0.25,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'launch-radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A multiple measured on the snapshot: its value, how many live protocols stand behind it, and its scope. */
export interface Multiple {
  value: number;
  samples: number;
  scope: 'category' | 'global';
}

/** Every multiple the model uses, measured once per run. */
export interface Multiples {
  global: Multiple;
  by_category: Record<string, Multiple>;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  tier: 'watchlist' | 'early';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    multiple: number;
    multiple_scope: 'category' | 'global';
    multiple_samples: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page regenerates the farm plan from the same fields. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  multiple: number;
  multiple_scope: 'category' | 'global';
  multiple_samples: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  tier: 'watchlist' | 'early';
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl_ratio: number | null;
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  multiples: Multiples;
  protocol_count: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  total_implied_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Round to 4 decimals: the one rounding the board and the page both use for multipliers. */
export const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list of finite numbers, sorted numerically first: the same bytes every run. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A wrapped, staked or staking product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Categories that are a wrapped, staked or bridged product, or an exchange, never a launch of their own. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Exchange names a wrapped product's name begins with. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/**
 * Whether a protocol is one the board may rank: it records no token and passes the watchlist rule's
 * visible tests (the snapshot carries no parent-protocol field, so that one test is the list's own).
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((prefix) => p.name.startsWith(prefix))) return false;
  return true;
}

/**
 * The multiples, measured on the snapshot's live-token protocols: each category's median mcap/TVL
 * where at least `min_category_samples` live protocols carry both figures, clamped to
 * [multiple_clamp_low, multiple_clamp_high] of the global median; every other category takes the
 * global median. Rounded to 4 decimals so the board and the page agree to the digit.
 */
export function measureMultiples(snapshot: Snapshot, model: ModelConstants): Multiples {
  const ratiosByCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p)) continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Other';
    const list = ratiosByCategory.get(key);
    if (list) list.push(ratio);
    else ratiosByCategory.set(key, [ratio]);
  }
  const globalValue = all.length > 0 ? round4(median(all)) : model.fallback_multiple;
  const global: Multiple = { value: globalValue, samples: all.length, scope: 'global' };
  const byCategory: Record<string, Multiple> = {};
  for (const [category, ratios] of ratiosByCategory) {
    if (ratios.length < model.min_category_samples) continue;
    const clamped = Math.min(globalValue * model.multiple_clamp_high, Math.max(globalValue * model.multiple_clamp_low, median(ratios)));
    byCategory[category] = { value: round4(clamped), samples: ratios.length, scope: 'category' };
  }
  return { global, by_category: byCategory };
}

/** The multiple one protocol gets: its category's where measured, else the global one. */
export function multipleFor(p: SnapshotProtocol, multiples: Multiples): Multiple {
  const own = multiples.by_category[p.category ?? 'Other'];
  return own ?? multiples.global;
}

/** The implied value and its factors for one protocol under `model` and `multiples`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiples: Multiples,
): { implied: number; multiple: Multiple; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = multipleFor(protocol, multiples);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple.value * growthMult * maturityMult));
  return { implied, multiple, growthPct, growthMult, maturityMult, age };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Rough gas for one transaction on a chain, as the farm plan states it: a chain fact, not a protocol fact. */
export function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $12 of gas on Ethereum';
  if (c === 'bitcoin') return 'about $3 of network fees on Bitcoin';
  if (c === 'solana') return 'under $0.10 of fees on Solana';
  if (c === 'tron') return 'about $1 of fees on Tron';
  if (['base', 'arbitrum', 'optimism', 'polygon', 'zksync era', 'linea', 'scroll', 'blast', 'mantle', 'unichain', 'ink', 'soneium', 'mode', 'taiko', 'world chain', 'fraxtal', 'manta', 'bob', 'corn', 'lisk', 'swellchain', 'apechain', 'abstract', 'sonic', 'berachain', 'hyperevm', 'monad', 'arc'].includes(c)) {
    return `about $0.50 of gas on ${chain}`;
  }
  return `about $2 of gas on ${chain}`;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 25_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's two actions, in the words a farmer can follow: the main position and a second one. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): { main: string; second: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral')) {
    return {
      main: `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`,
      second: `Borrow a small amount against the supply and repay it a week later, so both sides of the market count.`,
    };
  }
  if (c.includes('cdp')) {
    return {
      main: `Open a vault on ${name}, deposit $${capital} of collateral and mint a small amount of its stablecoin.`,
      second: `Repay part of the debt and add collateral once, keeping the vault well above its liquidation line.`,
    };
  }
  if (c.includes('dex') || c.includes('liquidity manager')) {
    return {
      main: `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position open.`,
      second: `Make one swap a week through the pool so the account stays active on both sides.`,
    };
  }
  if (c.includes('bridge')) {
    return {
      main: `Bridge $${capital} of USDC through ${name} to ${chain} and use the bridged funds in its app.`,
      second: `Bridge a smaller amount once a week on a different route, so more than one path is recorded.`,
    };
  }
  if (c.includes('restak') || c.includes('staking')) {
    return {
      main: `Stake $${capital} of the staking asset through ${name} and keep the receipt token in the wallet.`,
      second: `Delegate to, or opt in to, one operator or service the app lists, so the stake is put to work.`,
    };
  }
  if (c.includes('derivative') || c.includes('interest rate')) {
    return {
      main: `Deposit $${capital} of USDC as margin on ${name} and open one small position.`,
      second: `Close and reopen the position once a week so trading activity is recorded, not just a deposit.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      main: `Fund the wallet with $${capital} and take a position in one open market on ${name}.`,
      second: `Trade one more market each week and keep the account funded between markets.`,
    };
  }
  if (c.includes('curator') || c.includes('allocator')) {
    return {
      main: `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`,
      second: `Move a small part into a second ${name} vault, so two vaults count the same wallet.`,
    };
  }
  if (c.includes('stable') || c.includes('wrapper')) {
    return {
      main: `Mint or wrap $${capital} of the stable asset through ${name} on ${chain} and hold it.`,
      second: `Put the wrapped asset to work once in a pool or lending app on the same chain.`,
    };
  }
  if (c.includes('rwa')) {
    return {
      main: `Buy or mint $${capital} of ${name}'s tokenized asset on ${chain} and hold it in the wallet.`,
      second: `Complete any identity check the app asks for and keep the holding past the next payout date.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      main: `Buy $${capital} of cover through ${name} on ${chain} and keep the policy active.`,
      second: `Renew or extend the cover once before it lapses, so the wallet holds cover twice.`,
    };
  }
  if (c.includes('chain')) {
    return {
      main: `Bridge $${capital} to ${chain} and use two apps native to ${name}'s chain.`,
      second: `Make a small transfer or swap on the chain every week, so the wallet is a regular there.`,
    };
  }
  if (c.includes('payment')) {
    return {
      main: `Open a payment channel or account with ${name} and route $${capital} through it.`,
      second: `Make one small payment a week so the channel stays active and funded.`,
    };
  }
  if (c.includes('basis')) {
    return {
      main: `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the shares.`,
      second: `Check the vault's yield page weekly and top up once if the rate still holds.`,
    };
  }
  if (c.includes('governance')) {
    return {
      main: `Deposit $${capital} into ${name}'s incentivized market on ${chain} while the program runs.`,
      second: `Vote, or claim the incentive, once a week for as long as the program pays it.`,
    };
  }
  if (c.includes('index')) {
    return {
      main: `Buy $${capital} of ${name}'s index token on ${chain} and hold it in the wallet.`,
      second: `Add a small amount once a month, so the holding grows instead of sitting still.`,
    };
  }
  if (c.includes('otc')) {
    return {
      main: `Place one $${capital} order on ${name} and settle it through the app.`,
      second: `Complete one more trade the following week, so the account has a history.`,
    };
  }
  if (c.includes('card')) {
    return {
      main: `Load $${capital} onto the ${name} card and make one purchase with it.`,
      second: `Spend a small amount each week, so the card stays active rather than loaded once.`,
    };
  }
  if (c.includes('btc')) {
    return {
      main: `Bridge or mint $${capital} of the Bitcoin asset through ${name} and hold it on ${chain}.`,
      second: `Use the asset once in a lending or pool app on the same chain.`,
    };
  }
  if (c.includes('yield') || c.includes('farm')) {
    return {
      main: `Deposit $${capital} into ${name}'s main vault on ${chain} and keep the shares.`,
      second: `Claim and re-deposit any rewards the vault pays, once a week.`,
    };
  }
  return {
    main: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    second: `Make one more deposit a week later, so the wallet is active in more than one week.`,
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const actions = actionsFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `${gas} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: actions.main,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: actions.second,
      cost: gas,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; multiples: Multiples } {
  const multiples = measureMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Beyond the floor: every other protocol that passes the same tests, at any size the snapshot holds.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const { implied, multiple, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, model, multiples);
    return { p, implied, multiple, growthPct, growthMult, maturityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const board = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    tier: watchlist.has(s.p.slug) ? ('watchlist' as const) : ('early' as const),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      multiple: s.multiple.value,
      multiple_scope: s.multiple.scope,
      multiple_samples: s.multiple.samples,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
  return { board, multiples };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl_ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    multiple: row.model.multiple,
    multiple_scope: row.model.multiple_scope,
    multiple_samples: row.model.multiple_samples,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    tier: row.tier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, multiples } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => r.tier === 'early').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    multiples,
    protocol_count: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    total_implied_usd: board.reduce((sum, r) => sum + r.implied_value_usd, 0),
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `the board holds ${board.length} rows, under the gate's 100`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'a slug appears twice on the board';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const invented = board.filter((r) => !known.has(r.slug)).map((r) => r.slug);
  if (invented.length > 0) return `the board invents slugs the snapshot does not list: ${invented.slice(0, 5).join(', ')}`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
