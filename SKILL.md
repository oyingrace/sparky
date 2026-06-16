---
name: sparky-build
description: Build instructions and conventions for Sparky, a Sui-based commitment app with a pari-mutuel prediction-market layer. Consult this whenever writing or modifying Sparky's Move contracts, its Next.js frontend, its event indexer, or its AI verifier worker — including anything involving goal escrow, betting/market logic, Community Pool redistribution, zkLogin, sponsored transactions, or the OracleCap-gated settlement flow. Read plan.md first for product scope and the locked decisions before touching this file's technical guidance.
---

# Building Sparky

This skill is the technical companion to `PLAN.md`. `PLAN.md` answers what to build and why; this file answers how to build it on Sui specifically, and what mistakes to avoid. If a question is about product scope, money model, or what's in/out of MVP, the answer is in `PLAN.md`, not here — don't re-derive product decisions from this file.

## Step 0: don't write Move from memory — install the official skills first

Sui's Move syntax and tooling conventions move faster than any model's training data. Before writing a single line of Move or touching the Sui CLI, run:

```
npx skills add mystenlabs/skills --all
```

This installs Sui Foundation's own maintained skill pack, including `sui-move`, `modern-move-syntax`, `object-model`, `naming-conventions`, `composable-move-functions`, `sui-move-project`, `move-unit-testing`, `sui-build-test`, `sui-publish`, `sui-cli`, `sui-client`, `ptbs`, `accessing-data`, `frontend-apps`, and `sui-sdks`. Treat those as the authoritative source for syntax, idioms, and CLI usage — this file only adds the Sparky-specific design on top, it does not re-teach Move. If `modern-move-syntax` and something written here ever conflict on a syntax question, `modern-move-syntax` wins.

If a `generate-sui-agent-config` skill is available, run it early to produce a project-tailored CLAUDE.md/AGENT.md — it's designed for exactly this situation.

## Repository layout

```
sparky/
├── move/
│   └── sparky/                  # single Move package, see "Move package" below
├── apps/
│   └── web/                     # Next.js frontend
├── services/
│   ├── indexer/                 # event listener -> Postgres, serves the API
│   └── verifier/                 # AI Game Master worker
└── plan.md, SKILL.md
```

One Move package called `sparky` for MVP, not one package per module — split into multiple packages only if upgrade/versioning needs force it later.

## Network and environment

Testnet only for the entire MVP — this is a locked product decision (`plan.md` Section 3), not just a default. Concretely:
- Every config file, `.env.example`, and deployment script should point at Testnet endpoints and Testnet faucet flows. Don't scaffold mainnet config "for later" — it invites someone to flip an env var and accidentally point a real-money flow at a contract that was never reviewed for that.
- Use `sui-install`/`sui-client` skill guidance for CLI setup, faucet requests, and address management rather than hand-rolling it.
- Keep deployed package IDs, shared object IDs (the `Config`, `CommunityPool`, and any registry objects), and the Enoki project IDs in one tracked file (e.g. `deployments/testnet.json`), never hardcoded inline across the frontend and services. Every phase in `plan.md` will redeploy this package multiple times; don't make that painful.

## Move package design

Read `object-model`, `naming-conventions`, and `composable-move-functions` from the official skills pack before writing any of this — what follows is the Sparky-specific shape those conventions should produce, not a replacement for them.

Modules, all in the single `sparky` package:

- **`sparky::admin`** — defines `AdminCap` and `OracleCap` capability objects, and a shared `Config` object holding protocol-wide parameters (protocol fee in bps, min/max stake, default lock-before-deadline buffer, current epoch id). `OracleCap` is the only thing allowed to call goal/market settlement functions — it lives with the verifier worker's signing key, not with the admin. Keep these capabilities separate even though one team controls both at MVP: they represent different trust boundaries (admin = configure the protocol, oracle = decide outcomes) and that distinction matters the moment a real dispute or audit happens.
- **`sparky::goal`** — the goal lifecycle as a shared object: owner address, description hash/pointer (don't store long free text on-chain — store a hash or off-chain pointer and keep the readable text in the indexer's database), proof-type tag, deadline, status enum (Active / Resolved-Success / Resolved-Failure / Disputed if that path ever gets built). Resolution is `OracleCap`-gated.
- **`sparky::commitment`** — the personal stake escrow, keyed to a `Goal`. Holds the staked `Balance`, returns it to the owner on success, and on failure calls into `sparky::community_pool`'s deposit function. Keep this separate from `sparky::market` — per `plan.md` Section 4's flagged assumption, a goal-setter's personal stake and that goal's bettor pool are two independent pots of money, and the code should make that separation structurally obvious (different shared objects, different balances), not just enforced by convention.
- **`sparky::market`** — one shared market object per public goal: `yes_pool`/`no_pool` balances, a `Table<address, Position>` for per-bettor positions (`{side, amount, claimed}`), `lock_at`, status, and settled outcome. Key functions: `place_bet`, `lock`, `resolve` (`OracleCap`-gated, called with the same outcome the goal itself resolved to), `claim` (pull-based payout per Section 7's pari-mutuel formula). Hard-require in `place_bet` that the bettor's address is not the goal owner's address — this is a security-relevant assertion, not a UX nicety, and must live in the Move function, not just be filtered out in the frontend.
- **`sparky::community_pool`** — one shared `CommunityPool` object holding the cumulative balance of forfeited personal stakes plus a per-epoch claims table. `deposit` is called by `sparky::commitment` on every forfeiture. `publish_epoch_claims` is `AdminCap`-gated and takes a pre-computed (off-chain, by the indexer) list of `(address, amount)` shares for the epoch that just closed — do not attempt to compute these shares by iterating over all users inside a Move function; that's an unbounded-cost anti-pattern (this is exactly the kind of problem DeepBook solved by building its own `BigVector` B+ tree — at Sparky's MVP scale, just push the computation off-chain and publish the result). `claim` is a simple pull function checked against that table.

Every state-changing function across these modules should emit an event (`GoalCreated`, `StakeDeposited`, `ProofSubmitted`, `GoalResolved`, `StakeForfeited`, `BetPlaced`, `MarketLocked`, `MarketResolved`, `WinningsClaimed`, `EpochPublished`, `RewardClaimed`). The indexer service should never need to diff raw object state to figure out what happened — every transition should be visible as an event.

**Don't do this:** don't take a Move-level dependency on the DeepBook v3 or DeepBook Predict packages for MVP. `plan.md` Section 6.1 explains why — DeepBook Predict in particular is pinned to a Testnet branch (`predict-testnet-4-16`) whose package IDs are explicitly documented as subject to change before Mainnet, and its `OracleSVI` is a price oracle, not a subjective-outcome oracle. Borrow the *shape* (manager-style account, shared vault, capability-gated settlement), not the code.

**Coin handling:** for MVP, have the frontend pass a `Coin` object directly into `create_goal`/`place_bet` calls (standard Sui pattern, `dapp-kit` handles coin selection), rather than building a `BalanceManager`/`PredictManager`-style reusable account object up front. That pattern (deposit once, reuse across many calls) is real and worth adopting eventually — DeepBook Predict's own `PredictManager` is exactly this — but it's added complexity Sparky's MVP doesn't need yet. Note it as a Phase 2+ UX upgrade, don't build it now.

## Frontend conventions

- `@mysten/dapp-kit` for wallet/transaction UI plumbing, `@mysten/sui` for the TS SDK. Read the `frontend-apps` and `sui-sdks` skills before scaffolding this.
- Auth is Enoki zkLogin with Google as the OAuth provider. Follow the same `/api/sponsor` → wallet sign → `/api/execute` flow Sui's own Solitaire example app uses for sponsored transactions — that example is the closest existing reference to Sparky's "no gas, no seed phrase" requirement and is worth reading end to end before building the transaction-submission hooks.
- Restrict the sponsorship endpoint's allowed Move call targets to exactly the Sparky entry functions in use (mirror Solitaire's pattern of an explicit allow-list) — an open sponsorship endpoint is a direct path to gas-griefing.
- Render goal feeds, market lists, portfolios, and history from the indexer's API, not from raw on-chain reads. Reserve direct on-chain object reads for the moments right around a wallet-signing flow where the UI needs to confirm exact current state (about to place a bet, about to claim) — this is the same split DeepBook Predict's own integration docs recommend, and it keeps the app fast without sacrificing correctness at the moments that matter.
- Show implied odds (`no_pool / yes_pool` and the inverse) live on each market, with a visible note that they can shift until `lock_at` — this isn't optional polish, it's load-bearing for users understanding a pari-mutuel market correctly (see `plan.md` Section 7's odds-aren't-locked-in tradeoff).

## Indexer service conventions

- Subscribe to the Sparky package's events (full list above) via Sui's checkpoint/event streaming, write normalized rows into Postgres, and serve the frontend from that — don't have the frontend query the chain directly for anything list-shaped (feeds, leaderboards, history).
- Own the Community Pool epoch-share computation. At the end of each epoch, query which users had at least one `GoalResolved`-success event during the period and what they had staked, compute proportional shares, and submit the `publish_epoch_claims` transaction with the admin key. This computation belongs here, not in Move (see the `community_pool` note above).

## Verifier worker conventions ("AI Game Master")

Build this as a staged pipeline, in this order, and don't skip the order:

1. **Deterministic rule checks** — EXIF metadata, GPS coordinates against any goal-specified location, timestamp inside the check-in window, device consistency. Cheap, runs on every submission, catches naive fraud before any model spend happens.
2. **Lightweight classifier** on the photo/proof content — a sanity check that the image plausibly matches the claimed activity. Still cheap, still runs on every submission that passes step 1.
3. **LLM reasoning** — reserved for ambiguous cases, integration-data conflicts, or anything steps 1–2 flagged as suspicious. This is the expensive path and should be measured and kept rare; if most check-ins are routing here, that's a signal steps 1–2 aren't doing their job, not a signal to just budget for more LLM calls.

The worker signs its final verdict with the `OracleCap`-controlled key before submitting `settle_goal`/`resolve_market`. Store the proof's SHA-256 hash on-chain in the `ProofSubmitted` event and keep the actual media in object storage, keyed so the hash can always be re-verified against the stored file later. When the Nautilus research pass happens (Phase 3+ in `plan.md`), this signing step is exactly what would move into a TEE enclave — structure the worker's "sign and submit" boundary as a clean, swappable function now so that move is straightforward later rather than a rewrite.

## Testing conventions

- Move unit tests per module, following the `move-unit-testing` skill's naming/assertion/cleanup conventions — every module above (`goal`, `commitment`, `market`, `community_pool`) needs tests for both the happy path and its specific edge cases, especially:
  - `market`: zero bets on the winning side, zero bets on the losing side, zero bets on both sides, a goal-owner address attempting to call `place_bet` on their own market (must abort).
  - `commitment`: forfeiture correctly reaches the Community Pool and not the goal's own market.
  - `community_pool`: a claim against a stale or already-claimed epoch entry must fail cleanly.
- After unit tests pass, run the full loop on actual Testnet (publish via `sui-publish` skill guidance, exercise create-goal → stake → bet → resolve → claim end to end with the faucet) before considering a phase done. Move unit tests catch logic bugs; they don't catch a misconfigured `OracleCap` handoff or an event the indexer isn't actually listening for.

## Things not to do

- Don't add mainnet config, real-money rails, or KYC flows — out of MVP scope per `plan.md`, and premature without the legal review `plan.md` Section 10 flags.
- Don't let the goal-setter's personal stake and their own goal's bettor pool share a balance or a shared object. Keep them structurally separate.
- Don't let `place_bet` succeed for the goal owner's own address — assert it in Move, not just in the UI.
- Don't compute Community Pool epoch shares by iterating all users inside a Move transaction.
- Don't take a code dependency on DeepBook v3 or DeepBook Predict packages for MVP logic.
- Don't build native mobile, witness/dispute review, or org/SSO features in this phase — they're explicitly sequenced later in `plan.md` Section 12.

## Reference links

- docs.sui.io/skills — the official Mysten Labs skills pack (`npx skills add mystenlabs/skills --all`).
- docs.sui.io/sui-stack/enoki/solitaire — zkLogin + sponsored transaction reference architecture.
- docs.sui.io/sui-stack/nautilus/ — TEE-based verifiable off-chain compute, the Phase 3+ oracle upgrade path.
- docs.sui.io/onchain-finance/deepbook-predict/design — the manager/vault/oracle pattern this package's shape borrows from.
- docs.sui.io/onchain-finance/deepbookv3/design — why a full CLOB (Pool/BalanceManager/DEEP fees) isn't needed for MVP, for context on what's being deliberately left out.