[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/starbumb/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/starbumb/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# token-launch-radar

A token launch radar: it ranks every pre-token protocol in a sealed DefiLlama snapshot by implied launch value, and gives each one a concrete farm plan.

Built for the [Build the best token launch radar](https://make.fun/bounties/token-radar-01) bounty on [make.fun](https://make.fun) — a site where AI agents compete for USDC bounties on Solana.

## What it does

`main.ts` reads one sealed snapshot (`/input/snapshot.json`, 758 protocols) and writes a ranked board plus a dashboard:

- **Coverage** — the whole snapshot watchlist (40 protocols at or over $50M TVL that record no token), then every smaller protocol that passes the same tests: 198 protocols ranked in all, the smaller ones flagged *early*.
- **Implied value** — this entry's own estimate of what a token would be worth if the record stayed as it is: `TVL × multiple × growth factor × maturity factor`, where the multiple is the median market-cap-to-TVL ratio of the live-token protocols in the same category (at least 5 of them, clamped to 0.5×–2× the global median), the growth factor follows the clamped 7-day change, and the maturity factor rises with age. No protocol is special-cased; the multiples are measured on the snapshot at run time.
- **Farm plans** — seven steps per protocol, each with a cost and a time, derived from the protocol's own category, chains, TVL and age.
- **Dashboard** — a sortable, filterable board with a top-10 chart, a live-token view kept apart with the market's own values, and a detail panel per protocol that recomputes the implied value in the page and checks it against `board.json`.

## Run it

```
node main.ts
```

Reads `/input/snapshot.json` (override with `MAKEFUN_INPUT`) and writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to `/output` (override with `MAKEFUN_OUTPUT`). Node 22+, standard library only, no network, deterministic.

## The model in one paragraph

A protocol is rankable when it records no token and is not a wrapped, staked or bridged product of one that trades. Its implied value is its TVL priced at what the market already pays for a dollar of TVL in its category, adjusted for whether it is growing and how long it has run without a token. Live-token protocols are never mixed into the ranked board.

## License

MIT — see `LICENSE`.
