'use strict';
// The dashboard: window.RADAR (data.js) in, a ranked board out. The same model that wrote board.json
// runs here, so every implied value on this page can be recomputed in the page and checked against it.
const R = window.RADAR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const usd = (n) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '\u2014';
  const a = Math.abs(n);
  if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
  return '$' + Math.round(n).toLocaleString('en-US');
};
const usdFull = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pct = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '\u2014' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%');
const age = (d) => (d === null || d === undefined ? '\u2014' : d >= 365 ? (d / 365).toFixed(1) + 'y' : d + 'd');
const round4 = (n) => Math.round(n * 1e4) / 1e4;

/* ---- the farm plan, regenerated in the page from the row's own record (mirrors lib/model.ts) ---- */
function gasFor(chain) {
  const c = String(chain).toLowerCase();
  if (c === 'ethereum') return 'about $12 of gas on Ethereum';
  if (c === 'bitcoin') return 'about $3 of network fees on Bitcoin';
  if (c === 'solana') return 'under $0.10 of fees on Solana';
  if (c === 'tron') return 'about $1 of fees on Tron';
  if (['base', 'arbitrum', 'optimism', 'polygon', 'zksync era', 'linea', 'scroll', 'blast', 'mantle', 'unichain', 'ink', 'soneium', 'mode', 'taiko', 'world chain', 'fraxtal', 'manta', 'bob', 'corn', 'lisk', 'swellchain', 'apechain', 'abstract', 'sonic', 'berachain', 'hyperevm', 'monad', 'arc'].includes(c)) {
    return 'about $0.50 of gas on ' + chain;
  }
  return 'about $2 of gas on ' + chain;
}
function capitalFor(tvl) {
  if (tvl >= 1e9) return 250;
  if (tvl >= 1e8) return 150;
  if (tvl >= 25e6) return 100;
  return 50;
}
function holdDaysFor(ageDays) {
  if (ageDays === null || ageDays === undefined) return 30;
  if (ageDays < 180) return 60;
  if (ageDays < 365) return 45;
  return 30;
}
function actionsFor(r, capital, chain) {
  const c = (r.category || '').toLowerCase();
  const name = r.name;
  if (c.includes('lend') || c.includes('collateral')) {
    return { main: `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`, second: 'Borrow a small amount against the supply and repay it a week later, so both sides of the market count.' };
  }
  if (c.includes('cdp')) {
    return { main: `Open a vault on ${name}, deposit $${capital} of collateral and mint a small amount of its stablecoin.`, second: 'Repay part of the debt and add collateral once, keeping the vault well above its liquidation line.' };
  }
  if (c.includes('dex') || c.includes('liquidity manager')) {
    return { main: `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position open.`, second: 'Make one swap a week through the pool so the account stays active on both sides.' };
  }
  if (c.includes('bridge')) {
    return { main: `Bridge $${capital} of USDC through ${name} to ${chain} and use the bridged funds in its app.`, second: 'Bridge a smaller amount once a week on a different route, so more than one path is recorded.' };
  }
  if (c.includes('restak') || c.includes('staking')) {
    return { main: `Stake $${capital} of the staking asset through ${name} and keep the receipt token in the wallet.`, second: 'Delegate to, or opt in to, one operator or service the app lists, so the stake is put to work.' };
  }
  if (c.includes('derivative') || c.includes('interest rate')) {
    return { main: `Deposit $${capital} of USDC as margin on ${name} and open one small position.`, second: 'Close and reopen the position once a week so trading activity is recorded, not just a deposit.' };
  }
  if (c.includes('prediction')) {
    return { main: `Fund the wallet with $${capital} and take a position in one open market on ${name}.`, second: 'Trade one more market each week and keep the account funded between markets.' };
  }
  if (c.includes('curator') || c.includes('allocator')) {
    return { main: `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`, second: `Move a small part into a second ${name} vault, so two vaults count the same wallet.` };
  }
  if (c.includes('stable') || c.includes('wrapper')) {
    return { main: `Mint or wrap $${capital} of the stable asset through ${name} on ${chain} and hold it.`, second: 'Put the wrapped asset to work once in a pool or lending app on the same chain.' };
  }
  if (c.includes('rwa')) {
    return { main: `Buy or mint $${capital} of ${name}'s tokenized asset on ${chain} and hold it in the wallet.`, second: 'Complete any identity check the app asks for and keep the holding past the next payout date.' };
  }
  if (c.includes('insurance')) {
    return { main: `Buy $${capital} of cover through ${name} on ${chain} and keep the policy active.`, second: 'Renew or extend the cover once before it lapses, so the wallet holds cover twice.' };
  }
  if (c.includes('chain')) {
    return { main: `Bridge $${capital} to ${chain} and use two apps native to ${name}'s chain.`, second: 'Make a small transfer or swap on the chain every week, so the wallet is a regular there.' };
  }
  if (c.includes('payment')) {
    return { main: `Open a payment channel or account with ${name} and route $${capital} through it.`, second: 'Make one small payment a week so the channel stays active and funded.' };
  }
  if (c.includes('basis')) {
    return { main: `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the shares.`, second: "Check the vault's yield page weekly and top up once if the rate still holds." };
  }
  if (c.includes('governance')) {
    return { main: `Deposit $${capital} into ${name}'s incentivized market on ${chain} while the program runs.`, second: 'Vote, or claim the incentive, once a week for as long as the program pays it.' };
  }
  if (c.includes('index')) {
    return { main: `Buy $${capital} of ${name}'s index token on ${chain} and hold it in the wallet.`, second: 'Add a small amount once a month, so the holding grows instead of sitting still.' };
  }
  if (c.includes('otc')) {
    return { main: `Place one $${capital} order on ${name} and settle it through the app.`, second: 'Complete one more trade the following week, so the account has a history.' };
  }
  if (c.includes('card')) {
    return { main: `Load $${capital} onto the ${name} card and make one purchase with it.`, second: 'Spend a small amount each week, so the card stays active rather than loaded once.' };
  }
  if (c.includes('btc')) {
    return { main: `Bridge or mint $${capital} of the Bitcoin asset through ${name} and hold it on ${chain}.`, second: 'Use the asset once in a lending or pool app on the same chain.' };
  }
  if (c.includes('yield') || c.includes('farm')) {
    return { main: `Deposit $${capital} into ${name}'s main vault on ${chain} and keep the shares.`, second: 'Claim and re-deposit any rewards the vault pays, once a week.' };
  }
  return { main: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`, second: 'Make one more deposit a week later, so the wallet is active in more than one week.' };
}
function farmSteps(r) {
  const chain = r.chains.length > 0 ? r.chains[0] : 'its main chain';
  const gas = gasFor(chain);
  const capital = capitalFor(r.tvl_usd);
  const hold = holdDaysFor(r.age_days);
  const a = actionsFor(r, capital, chain);
  return [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: gas + ' for the first transaction', time: '5 minutes' },
    { text: a.main, cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
    { text: a.second, cost: gas, time: '10 minutes' },
    { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: gas + ' a week', time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
    { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' },
  ];
}
/** The implied value, recomputed in the page from the row and the model, to check against board.json. */
function recompute(r) {
  const m = R.model;
  const growthPct = Math.min(m.growth_cap, Math.max(m.growth_floor, Number.isFinite(r.change_7d) ? r.change_7d : 0));
  const growthMult = 1 + (growthPct / 100) * m.growth_weight;
  const ageForModel = r.age_days === null || r.age_days === undefined ? m.unknown_age_days : r.age_days;
  const maturityMult = m.maturity_floor + (Math.min(Math.max(ageForModel, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
  return Math.max(1, Math.round(r.tvl_usd * r.multiple * growthMult * maturityMult));
}

/* ---- state ---- */
const state = { tab: 'pretoken', q: '', category: '', chain: '', tier: 'all', sortKey: 'rank', sortDir: 1, selected: null };
const bySlug = new Map(R.rows.map((r) => [r.slug, r]));

function readHash() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (h.get('p')) state.selected = h.get('p');
  if (h.get('q')) state.q = h.get('q');
  if (h.get('category')) state.category = h.get('category');
  if (h.get('chain')) state.chain = h.get('chain');
  if (h.get('tier')) state.tier = h.get('tier');
  if (h.get('tab')) state.tab = h.get('tab');
}
function writeHash() {
  const h = new URLSearchParams();
  if (state.selected) h.set('p', state.selected);
  if (state.q) h.set('q', state.q);
  if (state.category) h.set('category', state.category);
  if (state.chain) h.set('chain', state.chain);
  if (state.tier !== 'all') h.set('tier', state.tier);
  if (state.tab !== 'pretoken') h.set('tab', state.tab);
  const s = h.toString();
  history.replaceState(null, '', s ? '#' + s : location.pathname);
}

/* ---- hero + top 10 ---- */
function renderHero() {
  const g = R.multiples.global;
  $('meta').innerHTML = `snapshot <b>${esc(R.as_of)}</b><br>${esc(R.source)} &middot; model <b>${esc(R.model_version)}</b>`;
  $('src').textContent = R.source + ' ' + R.as_of;
  $('hero').innerHTML =
    `<div class="hero-copy"><h1>${R.board_size} pre-token protocols, ranked by <em>implied launch value</em></h1>` +
    `<p>Every protocol on this board records no token in the snapshot. The board covers the snapshot's whole watchlist of ${R.watchlist_size} protocols at or over ${usdFull(R.floor_usd)} TVL, then keeps going: ${R.early_size} smaller protocols that pass the same tests are ranked too, flagged <b>early</b>.</p>` +
    `<p>Implied value is this radar's own estimate of what a token would be worth if the record stayed as it is &mdash; TVL times a market multiple measured on the snapshot's live protocols, adjusted for 7-day growth and age. Click any row for the full breakdown and a step-by-step farm plan.</p></div>` +
    `<div class="stats">` +
    `<div class="stat"><div class="n acc">${R.watchlist_size}/${R.watchlist_size}</div><div class="l">watchlist covered</div></div>` +
    `<div class="stat"><div class="n">${R.board_size}</div><div class="l">protocols ranked</div></div>` +
    `<div class="stat"><div class="n">${usd(R.total_implied_usd)}</div><div class="l">total implied value</div></div>` +
    `<div class="stat"><div class="n">${g.value.toFixed(4)}&times;</div><div class="l">median live mcap/TVL (${g.samples} protocols)</div></div>` +
    `</div>`;
  const top = R.rows.slice(0, 10);
  const max = top.length ? top[0].implied_value_usd : 1;
  $('top10').innerHTML =
    `<h2>Top 10 by implied value <span>&mdash; click a bar for the farm plan</span></h2><div class="bars">` +
    top.map((r) =>
      `<button class="bar-row" data-slug="${esc(r.slug)}"><span class="rk">${r.rank}</span><span class="nm">${esc(r.name)}</span>` +
      `<span class="track"><span class="fill" style="width:${Math.max(2, (r.implied_value_usd / max) * 100).toFixed(1)}%"></span></span>` +
      `<span class="vl">${usd(r.implied_value_usd)}</span></button>`).join('') +
    `</div>`;
}

/* ---- model panel ---- */
function renderModel() {
  const m = R.model;
  const g = R.multiples.global;
  const cats = Object.entries(R.multiples.by_category)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, v]) => `<span class="mult-chip">${esc(cat)} <b>${v.value.toFixed(4)}&times;</b> (n=${v.samples})</span>`).join('');
  $('model').innerHTML =
    `<h2>The model</h2>` +
    `<div class="formula">implied value = max(1, round( TVL &times; <b>multiple</b> &times; growth factor &times; maturity factor ))</div>` +
    `<p><b>Multiple.</b> The market's own price for a dollar of TVL, measured on this snapshot: the median market-cap-to-TVL ratio of the live-token protocols in the same category (at least ${m.min_category_samples} of them), clamped to ${m.multiple_clamp_low}&times;&ndash;${m.multiple_clamp_high}&times; the global median of <b>${g.value.toFixed(4)}&times;</b> over ${g.samples} live protocols. Categories without enough live protocols take the global median.</p>` +
    `<p><b>Growth factor.</b> 1 + clamped 7-day change &times; ${m.growth_weight}: a protocol up 20% this week gets 1.10&times;, one down 60% or more gets 0.70&times; (change clamped to ${m.growth_floor}%&hellip;${m.growth_cap}%).</p>` +
    `<p><b>Maturity factor.</b> ${m.maturity_floor} to ${(m.maturity_floor + m.maturity_range).toFixed(1)} with age, reaching the top at ${m.maturity_days} days: a protocol that has run for years without a token is a stronger launch candidate than a new one. Unknown age counts as ${m.unknown_age_days} days.</p>` +
    `<p>No protocol is special-cased: one function scores every row, and the multiples are measured on the snapshot at run time, never typed in. Protocols whose token already trades are kept apart in the Live token view with the market's own values.</p>` +
    `<div class="mult-table">${cats}</div>`;
}

/* ---- table ---- */
function visibleRows() {
  const q = state.q.trim().toLowerCase();
  let rows = R.rows.filter((r) => {
    if (state.tier !== 'all' && r.tier !== state.tier) return false;
    if (state.category && r.category !== state.category) return false;
    if (state.chain && !r.chains.includes(state.chain)) return false;
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q) || (r.category || '').toLowerCase().includes(q) || r.chains.join(' ').toLowerCase().includes(q))) return false;
    return true;
  });
  const key = state.sortKey;
  const dir = state.sortDir;
  rows = [...rows].sort((a, b) => {
    let va, vb;
    if (key === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    else if (key === 'age') { va = a.age_days ?? -1; vb = b.age_days ?? -1; }
    else if (key === 'tvl') { va = a.tvl_usd; vb = b.tvl_usd; }
    else if (key === 'chg') { va = a.change_7d ?? -Infinity; vb = b.change_7d ?? -Infinity; }
    else if (key === 'implied') { va = a.implied_value_usd; vb = b.implied_value_usd; }
    else if (key === 'mult') { va = a.multiple; vb = b.multiple; }
    else { va = a.rank; vb = b.rank; }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return a.rank - b.rank;
  });
  return rows;
}
function visibleLive() {
  const q = state.q.trim().toLowerCase();
  return R.live.filter((r) => {
    if (state.category && r.category !== state.category) return false;
    if (state.chain && !r.chains.includes(state.chain)) return false;
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q) || (r.category || '').toLowerCase().includes(q) || r.chains.join(' ').toLowerCase().includes(q))) return false;
    return true;
  });
}
function headCell(label, key, num) {
  const on = state.sortKey === key;
  const arr = on ? (state.sortDir === 1 ? ' \u25B2' : ' \u25BC') : '';
  return `<th class="${num ? 'num' : ''}" data-sort="${key}">${label}<span class="arr">${arr}</span></th>`;
}
function renderTable() {
  const thead = document.querySelector('#board thead');
  const tbody = document.querySelector('#board tbody');
  const empty = $('empty');
  if (state.tab === 'live') {
    thead.innerHTML = '<tr>' + headCell('Live-token protocol', 'name') + headCell('Market cap', 'implied', true) + headCell('TVL', 'tvl', true) + headCell('Mcap / TVL', 'mult', true) + headCell('7d', 'chg', true) + '</tr>';
    const rows = visibleLive();
    tbody.innerHTML = rows.map((r) =>
      `<tr><td class="proto"><span class="nm">${esc(r.name)}</span><div class="sub">${esc(r.category || 'Other')} &middot; ${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ' +' + (r.chains.length - 3) : ''}</div></td>` +
      `<td class="num">${usd(r.mcap_usd)}</td><td class="num">${usd(r.tvl_usd)}</td>` +
      `<td class="num">${r.mcap_tvl_ratio === null ? '\u2014' : r.mcap_tvl_ratio.toFixed(4) + '&times;'}</td>` +
      `<td class="num ${r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'}">${pct(r.change_7d)}</td></tr>`).join('');
    $('count').textContent = rows.length + ' live-token protocols \u00B7 the market\u2019s own values, not the model\u2019s';
    empty.hidden = rows.length > 0;
    empty.textContent = 'No live-token protocol matches.';
    return;
  }
  thead.innerHTML = '<tr>' + headCell('#', 'rank') + headCell('Protocol', 'name') + headCell('TVL', 'tvl', true) + headCell('7d', 'chg', true) + headCell('Age', 'age', true) + headCell('Multiple', 'mult', true) + headCell('Implied value', 'implied', true) + '</tr>';
  const rows = visibleRows();
  const maxImp = R.rows.length ? R.rows[0].implied_value_usd : 1;
  tbody.innerHTML = rows.map((r) =>
    `<tr data-slug="${esc(r.slug)}" class="${state.selected === r.slug ? 'sel' : ''}"><td class="rank">${r.rank}</td>` +
    `<td class="proto"><span class="nm">${esc(r.name)}</span><span class="badge ${r.tier === 'watchlist' ? 'watch' : 'early'}">${r.tier === 'watchlist' ? 'watchlist' : 'early'}</span>` +
    `<div class="sub">${esc(r.category || 'Other')} &middot; ${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ' +' + (r.chains.length - 3) : ''}</div></td>` +
    `<td class="num">${usd(r.tvl_usd)}</td>` +
    `<td class="num ${r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'}">${pct(r.change_7d)}</td>` +
    `<td class="num">${age(r.age_days)}</td>` +
    `<td class="num">${r.multiple.toFixed(4)}&times;</td>` +
    `<td class="num imp"><span class="v">${usd(r.implied_value_usd)}</span><span class="ib"><i style="width:${Math.max(2, (r.implied_value_usd / maxImp) * 100).toFixed(1)}%"></i></span></td></tr>`).join('');
  $('count').textContent = rows.length + ' of ' + R.board_size + ' protocols';
  empty.hidden = rows.length > 0;
  empty.textContent = 'No protocol matches. Clear the search or a filter.';
}

/* ---- detail panel ---- */
function renderDetail() {
  const panel = $('detail');
  const r = state.selected ? bySlug.get(state.selected) : null;
  if (!r) { panel.hidden = true; panel.innerHTML = ''; return; }
  const m = R.model;
  const recalc = recompute(r);
  const agrees = recalc === r.implied_value_usd;
  const multSrc = r.multiple_scope === 'category'
    ? `median of ${r.multiple_samples} live ${esc(r.category || 'Other')} protocols`
    : `global median of ${r.multiple_samples} live protocols`;
  const steps = farmSteps(r).map((s, i) =>
    `<div class="step"><div class="t"><b>${i + 1}.</b> ${esc(s.text)}</div><div class="ct"><b>Cost</b> ${esc(s.cost)} &middot; <b>Time</b> ${esc(s.time)}</div></div>`).join('');
  panel.innerHTML =
    `<button class="close" id="close">Close</button>` +
    `<div class="rk">Rank ${r.rank} of ${R.board_size} &middot; ${r.tier === 'watchlist' ? 'watchlist' : 'early radar'}</div>` +
    `<h2>${esc(r.name)}</h2>` +
    `<div class="sub">${esc(r.category || 'Other')} &middot; records no token in the snapshot</div>` +
    `<div class="big">${usdFull(r.implied_value_usd)}</div><div class="big-l">implied launch value &mdash; this radar&rsquo;s own estimate</div>` +
    `<table class="factors">` +
    `<tr><td>TVL</td><td>${usdFull(r.tvl_usd)}</td></tr>` +
    `<tr><td>Multiple (${multSrc})</td><td>&times; ${r.multiple.toFixed(4)}</td></tr>` +
    `<tr><td>7-day change ${pct(r.change_7d)} &rarr; growth factor</td><td>&times; ${r.growth_multiplier.toFixed(4)}</td></tr>` +
    `<tr><td>Age ${r.age_days === null ? 'unknown (' + m.unknown_age_days + 'd assumed)' : r.age_days + ' days'} &rarr; maturity factor</td><td>&times; ${r.maturity_multiplier.toFixed(4)}</td></tr>` +
    `<tr class="total"><td>Implied value</td><td>${usdFull(r.implied_value_usd)}</td></tr></table>` +
    `<p class="check">Recomputed in this page from the row and the model: <b>${usdFull(recalc)}</b> &mdash; ${agrees ? 'agrees with board.json to the dollar.' : 'DISAGREES with board.json.'}</p>` +
    `<h3>Farm plan &mdash; 7 steps</h3><div class="steps">${steps}</div>` +
    `<h3>The record</h3><div class="facts">` +
    `<div>Listed: <b>${r.listed_at ? esc(r.listed_at) : 'not recorded'}</b></div>` +
    `<div>Chains: <b>${esc(r.chains.join(', ') || 'none recorded')}</b></div>` +
    `<div>Tier: <b>${r.tier === 'watchlist' ? 'watchlist &mdash; at or over the ' + usdFull(R.floor_usd) + ' floor' : 'early radar &mdash; under the floor, same tests'}</b></div>` +
    `<div>Token: <b>records no token in the snapshot</b></div></div>`;
  panel.hidden = false;
  $('close').addEventListener('click', () => { state.selected = null; writeHash(); renderDetail(); renderTable(); });
}

/* ---- controls ---- */
function fillSelects() {
  const cats = [...new Set(R.rows.map((r) => r.category || 'Other'))].sort();
  const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
  $('category').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option value="${esc(c)}"${state.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map((c) => `<option value="${esc(c)}"${state.chain === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
}
function syncControls() {
  $('q').value = state.q;
  document.querySelectorAll('#tabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  document.querySelectorAll('#tiers .tier').forEach((b) => b.classList.toggle('on', b.dataset.tier === state.tier));
}
function wire() {
  $('q').addEventListener('input', (e) => { state.q = e.target.value; writeHash(); renderTable(); });
  $('category').addEventListener('change', (e) => { state.category = e.target.value; writeHash(); renderTable(); });
  $('chain').addEventListener('change', (e) => { state.chain = e.target.value; writeHash(); renderTable(); });
  document.querySelectorAll('#tabs .tab').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; writeHash(); syncControls(); renderTable(); }));
  document.querySelectorAll('#tiers .tier').forEach((b) => b.addEventListener('click', () => { state.tier = b.dataset.tier; writeHash(); syncControls(); renderTable(); }));
  document.querySelector('#board thead').addEventListener('click', (e) => {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const key = th.dataset.sort;
    if (state.sortKey === key) state.sortDir = -state.sortDir;
    else { state.sortKey = key; state.sortDir = key === 'rank' || key === 'name' ? 1 : -1; }
    renderTable();
  });
  document.querySelector('#board tbody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.selected = tr.dataset.slug;
    writeHash();
    renderTable();
    renderDetail();
  });
  $('top10').addEventListener('click', (e) => {
    const b = e.target.closest('[data-slug]');
    if (!b) return;
    state.selected = b.dataset.slug;
    writeHash();
    renderTable();
    renderDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selected) { state.selected = null; writeHash(); renderDetail(); renderTable(); }
  });
}

/* ---- go ---- */
readHash();
renderHero();
renderModel();
fillSelects();
syncControls();
wire();
renderTable();
renderDetail();
