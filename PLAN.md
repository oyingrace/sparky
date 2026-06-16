# Sparky — MVP Plan

Status: draft for review. Written for a human founder and an AI build agent to align on scope before any code is written.

## 1. What Sparky is

Sparky is commitment infrastructure with a social betting layer, built on Sui. The long-term product is an enterprise accountability platform (teams, squads, manager dashboards, org-wide goal programs). The MVP is the consumer core loop that the enterprise product will eventually sit on top of.

The MVP has two layers that must both work before anything else gets built:

1. **Personal commitment loop** — a user declares a goal, stakes test tokens on it, checks in with proof, an AI verifier judges the proof, and the stake is returned on success or forfeited on failure. This layer is modeled closely on Operator Uplift (operatoruplift.com), which we researched directly as the reference product (see Section 2).
2. **Public prediction market layer** — Sparky's differentiator. Other users can see an active goal and bet on whether the goal-setter will hit it. Correct bettors split incorrect bettors' stakes. This is the novel piece nothing in the reference product does, and it's the part that needs the most careful design because real incentives and integrity risks show up the moment third parties have money riding on someone else's self-reported behavior.

Both layers settle on Sui. DeepBook v3 and DeepBook Predict (Sui's own order-book and prediction-market primitives) were evaluated as possible foundations — see Section 6 for why we are not building directly on top of either for MVP, and where they fit later.

## 2. Reference model: what we're taking from Operator Uplift

Operator Uplift's MVP is "commit, stake, prove, settle." A user writes a specific, checkable commitment, stakes real money (or just uses it free without stakes), uploads proof at check-in time, and an AI Game Master scores the proof and streams its reasoning back. Honoring the commitment returns the stake and grows a streak; missing it forfeits the stake, which is redistributed to other users who kept their word during the same period, minus a small protocol fee — the company explicitly does not keep the forfeited funds itself.

Their verification stack is cost-controlled and staged: cheap deterministic checks first (EXIF data, GPS, timestamp, device fingerprint), then a cheap classifier model on the photo, and only then an LLM for edge cases, disputes, and fraud signals. Disputed AI verdicts can be appealed to a witness or human reviewer. Their pricing ladder is Free (one commitment, no stakes, tests the loop) → Pro (unlimited commitments, real stakes, witnesses, on-chain settlement) → Circle (group commitments, shared stakes, coach role) → Enterprise (SSO, per-seat pricing, org-wide goals and leaderboards, compliance paperwork).

Sparky's MVP adopts the same commit → stake → prove → settle skeleton and the same staged, cost-controlled verification philosophy, and reserves the team/org/SSO/leaderboard tier for the enterprise phase rather than the MVP.

## 3. Decisions locked for MVP

These were confirmed with the founder and should not be re-opened without a deliberate conversation:

| Decision | Choice | Why it matters |
|---|---|---|
| Network / money | **Sui Testnet only, test tokens, no real financial value** | Lets us prove the full loop (commitment + market + AI verification + settlement) without touching money-transmission, gambling, or derivatives regulation. Mainnet/real-money is a deliberate later phase, not an MVP deliverable. |
| Goal verification | **AI-only**, modeled on Operator Uplift's staged verifier (rules → cheap classifier → LLM only for edge cases) | No witness or human-review step in MVP. This is the highest-risk simplification (see Section 9) and should be revisited once real money is in play. |
| Prediction market mechanics | **Pari-mutuel pool**: correct bettors split incorrect bettors' stakes proportionally, net of a protocol fee | Simpler to build and reason about than an AMM/vault model. No liquidity providers, no impermanent loss, no pricing curve to get wrong. The tradeoff (bettors don't know their exact payout multiplier until the market locks) is explained in Section 7. |

## 4. Open questions / assumptions to validate before Phase 1 starts

The original brief described two things that sound similar but, on inspection, should be two separate mechanisms. Flagging this explicitly because getting it wrong changes the Move object model:

- **"If you achieve it, they [bettors] will make a profit, if not their capital will be sent to the community pool."** This is the per-goal prediction market. With the pari-mutuel decision above, this is direct: the losing side's stakes (minus fee) are redistributed to the winning side of that specific market. No separate persistent "community pool" is needed for this part — the per-market pool itself is the redistribution mechanism.
- **"If you set a goal for yourself and do not achieve it, the funds you staked will be lost."** This is the personal commitment stake, separate from anyone else's bet. The plan below assumes this follows Operator Uplift's model exactly: forfeited personal stakes flow into a single, platform-wide **Community Pool** that periodically (e.g., weekly) redistributes to users who honored their own commitments during that period, proportional to what they had staked.

**Assumption made, please confirm:** these are two independent pots of money — a goal-setter's personal stake never mixes with that same goal's bettor pool, and a goal-setter cannot bet on their own market (enforced on-chain). This avoids a goal-setter being able to manipulate or double-dip on their own outcome. If the intent was actually a single unified pool, that's a different (and trickier) design and should be discussed before Phase 2.

Other open items worth a real conversation before they're load-bearing:

- Should a goal have exactly one binary outcome (hit/missed by a deadline), or can it have recurring check-ins like Operator Uplift's "run 4x this week" with a market that resolves on the final day? MVP plan below assumes **single binary outcome per goal, one deadline**, for simplicity — recurring goals are a Phase 2+ extension.
- How long before a goal's deadline does betting lock? Locking exactly at the deadline lets a goal-setter (or someone with inside knowledge of their progress) bet with privileged information in the final hours. The plan recommends a configurable `lock_at` time set meaningfully before `deadline`, defaulting to e.g. 24 hours prior, but this number needs a product decision.
- What happens if a market gets zero bets on one side? (Plan handles this as a no-op refund of principal — see Section 7 — but it's worth knowing this will happen often at small scale and markets may feel anticlimactic without seed liquidity.)
- What's the dispute path when there's no human reviewer? AI-only verification means a wrong AI call has no appeal in MVP. Worth deciding now whether that's acceptable for a testnet MVP (probably yes) versus mainnet (probably not).

## 5. MVP scope

**In scope:**
- Account creation via zkLogin (Google sign-in), no seed phrases, no manual wallet setup.
- Create a goal: description, proof type, stake amount (test tokens), deadline.
- Stake personal funds in escrow on goal creation.
- Daily/periodic check-in with proof upload (photo, GPS, or integration webhook stub).
- Staged AI verification of proof (rules → classifier → LLM escalation).
- Personal settlement: stake returned on success, forfeited to the Community Pool on failure.
- Public feed of active goals (opt-in visibility per goal).
- Per-goal pari-mutuel betting market: place a YES/NO bet, view live implied odds, claim winnings after resolution.
- Periodic Community Pool redistribution to users who honored commitments that period.
- Basic profile: streak, honor rate, history of goals and bets.

**Explicitly out of scope for MVP:**
- Real money, mainnet, fiat or USDC rails, KYC.
- Witnesses, human review, or dispute appeals (AI verdict is final in MVP).
- Group/Circle commitments, coach roles, org dashboards, SSO — the Enterprise and Circle tiers.
- Native iOS/Android apps (build a responsive web app first; see Section 6).
- Liquidity-provider/vault-style market making (DeepBook Predict's model) — reconsidered post-MVP.
- Secondary trading of bet positions on an order book.
- Recurring/multi-check-in goals (one goal = one binary outcome by one deadline).

## 6. System architecture

### 6.1 Why not build directly on DeepBook v3 or DeepBook Predict

DeepBook v3 is a full central limit order book (Pool, PoolRegistry, BalanceManager, DEEP token fees, maker/taker governance) built for continuous token trading. Sparky's MVP doesn't need an order book — goals aren't fungible assets being traded against a market price, they're one-off bets that settle once at a known time. Pulling in DeepBook v3 would mean carrying its governance, fee-tier, and DEEP-staking machinery for no benefit at MVP scale.

DeepBook Predict is closer in spirit — it already has the "binary position against an expiry" shape we want, plus a vault/PLP liquidity-provider model that's a legitimate template to study. But it's purpose-built for **oracle price feeds** (`OracleSVI` tracks spot/forward/SVI parameters for an underlying asset), and its settlement model resolves a position against a market price at expiry. Sparky's resolution event isn't a price — it's a subjective, AI-scored judgment of human behavior. Mapping that onto an `OracleSVI` object would mean misusing a price oracle to carry an opaque success/fail signal, with no real benefit. On top of that, DeepBook Predict is explicitly documented as a Testnet-only integration target on a pinned branch (`predict-testnet-4-16`), with package IDs and object layouts called out as subject to change before Mainnet. Building a real dependency on it now would mean re-integrating after every breaking change on a protocol we don't control.

**Decision:** build a small, custom Move package for Sparky's goal/market/settlement logic, deliberately structured the way DeepBook Predict is structured (a manager-style account object, a shared pool/vault object, a capability-gated settlement step) so that the pattern is familiar and the pieces could be swapped for DeepBook Predict's machinery later if it stabilizes and its oracle model turns out to fit. Don't take an actual code dependency on either DeepBook v3 or DeepBook Predict in MVP.

### 6.2 High-level components

```
┌─────────────────────────┐
│   Web app (Next.js)      │  zkLogin via Enoki, dapp-kit for wallet/tx,
│   responsive, PWA-ready  │  sponsored transactions (users never pay gas
└─────────────┬─────────────┘  or see a seed phrase)
              │
              ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│  Sparky API / indexer     │◄────│  Sui Testnet (Move pkg)    │
│  - reads indexed state    │     │  - sparky::goal            │
│  - serves feeds, profiles │     │  - sparky::commitment      │
│  - listens to chain events│────►│  - sparky::market           │
└─────────────┬─────────────┘      │  - sparky::community_pool  │
              │                    │  - sparky::admin (caps)    │
              ▼                    └──────────────────────────┘
┌─────────────────────────┐                 ▲
│  Verifier worker          │                 │ settle_goal() / resolve_market()
│  (AI Game Master)         │─────────────────┘ signed with OracleCap
│  rules → classifier → LLM │
└─────────────────────────┘
```

### 6.3 Frontend

A responsive Next.js web app, not a native app, for MVP — the founder's "very large enterprise product" framing and the Operator Uplift reference both eventually want native mobile, but a web app is faster to iterate on and is where the betting/social feed (the actually novel part) can be validated fastest. Native apps are a Phase 2+ decision once the loop is proven.

Wallet UX follows the pattern Sui's own example apps use for exactly this kind of consumer product (the Solitaire reference app is the clearest template): Enoki zkLogin with Google OAuth derives a Sui address with no seed phrase, and every transaction is sponsored so the user never sees a gas prompt. This matches Operator Uplift's own stated promise that "you do not need to be crypto-native" — Sparky should hold to the same bar even though it settles on a real blockchain instead of card rails.

### 6.4 Backend services

- **Indexer/API service.** Listens to on-chain events (`GoalCreated`, `StakeDeposited`, `ProofSubmitted`, `GoalResolved`, `StakeForfeited`, `BetPlaced`, `MarketLocked`, `MarketResolved`, `WinningsClaimed`, `EpochPublished`, `RewardClaimed`) and writes them into a normal relational database for fast reads. This mirrors DeepBook Predict's own documented integration guidance: render pages from an indexed server, use chain event streams only for live updates, and only read raw on-chain objects right around wallet-signing flows that need authoritative state. Don't build the UI around raw chain scans.
- **Verifier worker (the "AI Game Master").** Staged pipeline matching Operator Uplift's disclosed approach:
  1. Deterministic rule checks on the proof (EXIF metadata, GPS coordinates against any goal-specified location, timestamp inside the check-in window, device consistency). Cheap, runs on every submission.
  2. A small classifier model on the photo/proof content as a sanity check (cheap, runs on every submission that passes step 1).
  3. An LLM reasoning pass, used only for ambiguous cases, integration-data conflicts, or anything flagged suspicious by steps 1–2. This is the expensive step and should be the rare path, not the default one.
  The worker's final verdict is signed with the service's `OracleCap`-controlled key and submitted on-chain via `settle_goal` / `resolve_market`.
- **Scheduler.** Watches goal deadlines and market `lock_at` times, triggers the lock, prompts users for final check-ins, and triggers the Community Pool's periodic redistribution computation.
- **Notifications.** Push/email reminders for check-ins, mirroring Operator Uplift's daily nudge pattern. Not a deep MVP investment, but the hook points (check-in due, market about to lock, goal resolved, reward claimable) should exist from day one.

### 6.5 Proof storage

Store proof media (photos, GPS payloads) in centralized object storage for MVP, and commit a SHA-256 hash of the proof on-chain as part of the `ProofSubmitted` event so the verdict is checkable against the exact bytes the verifier scored. Sui's own decentralized blob storage layer, Walrus, is a credible upgrade path for tamper-evident proof storage once the loop is proven — worth a dedicated research pass when that phase starts (docs.sui.io/sui-stack/walrus/), not before.

## 7. Prediction market mechanics (pari-mutuel)

Each goal that's made public gets exactly one market with two sides, YES (will hit the goal) and NO (won't). Bettors deposit test tokens into whichever side they believe; the contract tracks a running `yes_pool` and `no_pool` balance plus a per-address position (side, amount, claimed flag).

**Locking.** New bets stop being accepted at the market's `lock_at` time, which should be set meaningfully before the goal's `deadline` (a product decision flagged in Section 4) rather than at the same instant, specifically to prevent the goal-setter — who has private knowledge of their own progress — or anyone colluding with them from betting on inside information in the final hours.

**Resolution.** Once the verifier worker posts a verdict, the market settles to whichever side matches the outcome.

**Payout.** This is a standard pari-mutuel split: the winning side's principal is returned in full, plus a pro-rata share of the losing side's pool, net of a protocol fee taken only from the losing pool (the same "the take" mechanic used in pari-mutuel betting generally, and conceptually identical to Operator Uplift's own "small protocol fee covers operations, the company does not profit from your failure"). For a winning bettor who staked `s`, out of a winning pool of total size `W` and a losing pool of total size `L`, with protocol fee `f`:

```
payout(s) = s + (s / W) × L × (1 − f)
```

**The honest tradeoff to flag:** because payout depends on the final size of both pools at lock time, a bettor doesn't know their exact payout multiplier the moment they place a bet — only once the market locks. The UI should show a live "implied odds" indicator (`no_pool / yes_pool` and vice versa) so bettors have a real-time sense of consensus, with a clear disclaimer that it can keep shifting until lock.

**Edge cases that need explicit handling, not just hope:**
- One side has zero bets when the market resolves in that side's favor (nobody bet correctly, or only the winning side ever had bets) — there's no losing pool to redistribute, so winners simply get their principal back with no profit. This will happen often at small scale; the contract math needs a guard against dividing by zero here, not an assumption that both pools are always non-empty.
- A goal-setter cannot place a bet on their own market, in either direction — enforced as an on-chain assertion (bettor address ≠ goal owner address), not just a frontend check, since the frontend can be bypassed.
- A market with literally zero bets on both sides at lock time just has nothing to resolve; no special handling needed beyond not crashing.

**Seed liquidity is a known weakness, not a bug to silently fix now.** Pari-mutuel markets with no liquidity providers mean a brand-new goal with no bettor interest yet just sits there uninteresting. DeepBook Predict's vault/LP-share model (where liquidity providers fund a vault that takes the other side of every trade) is the natural answer to this, and is exactly why it was studied during planning — but bringing in passive liquidity providers also reintroduces real financial risk and AMM pricing complexity that this MVP is deliberately avoiding. Revisit this once the pari-mutuel loop is proven and real liquidity (even play-money liquidity) turns out to be a real adoption blocker.

## 8. Personal commitment stake & Community Pool

This is the part modeled directly on Operator Uplift and kept deliberately separate from the betting market (see Section 4's open question).

A user stakes test tokens into escrow when creating a goal. On success, the full stake returns to them and their streak/honor-rate updates. On failure, the stake is transferred into a single, platform-wide **Community Pool** shared object — not back to anyone in particular, and not into that goal's betting market.

Periodically (a weekly epoch is a reasonable default, matching the cadence implied by Operator Uplift's "redistributed to other operators who kept their word during the same period"), the Community Pool's accumulated balance for that period is distributed to every user who honored at least one personal commitment during the period, proportional to what they had staked. Because this requires summing across an arbitrary, growing number of users, the contract should not try to loop over all users on-chain in a single transaction — that's a known anti-pattern on Sui (DeepBook itself uses a custom B+ tree, `BigVector`, specifically to avoid this problem at trading scale). For MVP scale, the simpler and sufficient pattern is: compute each user's share off-chain in the indexer, publish the resulting claim table on-chain in one capability-gated transaction at the start of the new epoch, and let each user pull their own share with a `claim` transaction. This is the same pull-based pattern most airdrop and rewards systems use for the same reason.

## 9. Trust, integrity, and the AI oracle's centralization problem

The single biggest trust assumption in this entire design is the verifier worker: it's the only thing deciding whether goals succeed and markets resolve, and at MVP it's a centralized service holding a capability key (`OracleCap`) that can call `settle_goal` and `resolve_market`. That's an acceptable, explicit trade for a testnet MVP with no real money on the line, but it should be named as exactly what it is rather than quietly assumed away: a single key, controlled by Sparky, decides who wins and loses every market.

Other integrity risks worth designing around even at MVP scale, since "no real money" doesn't mean "no incentive to cheat" once social status, streaks, or even test-token bragging rights are involved:
- **Self-betting / sock puppets.** The on-chain ban on a goal-setter betting on their own market (Section 7) only stops the obvious case. A goal-setter could still get a friend or second wallet to bet against them and then deliberately fail. There's no full fix for this at MVP without identity verification, but it's worth at minimum rate-limiting or flagging accounts that bet heavily and specifically against goals created by addresses they've interacted with before.
- **Proof fraud.** Photo/GPS spoofing is a real, well-known attack against exactly this kind of verification stack, which is precisely why Operator Uplift's own disclosed pipeline leads with cheap deterministic checks (EXIF, GPS, timestamp, device) before any ML or LLM step — those cheap checks catch a large share of naive spoofing for very little cost, and Sparky's verifier should copy that ordering rather than going straight to an LLM.
- **Upgrade path for the oracle.** Sui has a real, documented answer to "how do you stop trusting one centralized key for an oracle": Nautilus, Sui's framework for running off-chain logic inside a trusted execution environment and verifying the result's signature on-chain before a Move contract acts on it (its own reference example is literally a weather oracle: a TEE fetches data, signs it, and the contract checks the signature before minting). The AI Game Master verdict is structurally the same shape — fetch proof, run a judgment, sign it, post on-chain. This is the natural Phase 2/3 path to take the verifier out of "trust me, it's a normal server" territory, and should be scoped as real follow-up work, not a footnote.

## 10. Regulatory note (not legal advice)

Even though MVP intentionally uses test tokens with no real value, the long-term enterprise vision implies eventually moving to real money on a betting market tied to subjective, personal outcomes. That combination — third parties wagering real value on a binary outcome — plausibly intersects gambling law in some jurisdictions and, depending on structure, derivatives/event-contract regulation in others (this is an actively contested, jurisdiction-specific area even for established prediction-market companies). This isn't a blocker for building the testnet MVP, but real-money mainnet launch should not happen without dedicated legal review specific to the jurisdictions Sparky intends to operate in. Claude isn't a lawyer and this isn't legal advice — flagging it now so it isn't a surprise later.

## 11. Tech stack summary

| Layer | Choice | Notes |
|---|---|---|
| Smart contracts | Sui Move, custom `sparky` package | Structured like DeepBook Predict's manager/vault/capability pattern, no direct dependency on DeepBook v3 or DeepBook Predict for MVP |
| Network | Sui Testnet | Per locked decision in Section 3 |
| Wallet/auth | Enoki zkLogin (Google OAuth) | No seed phrases; matches the Solitaire reference app's pattern |
| Transactions | Sponsored transactions via Enoki | Users never pay gas or see a gas prompt |
| Frontend | Next.js, `@mysten/dapp-kit`, `@mysten/sui` TS SDK | Responsive web app, PWA-ready, not native for MVP |
| Backend indexer/API | Node/TypeScript service consuming Sui event streams into Postgres | Mirrors DeepBook Predict's documented "index, don't raw-scan" guidance |
| Verifier worker | Staged pipeline: deterministic rules → small classifier → LLM escalation | Same cost-controlled philosophy Operator Uplift discloses publicly |
| Proof storage | Centralized object storage + on-chain SHA-256 hash commitment | Walrus is a credible later upgrade, not an MVP dependency |

## 12. Build phases

**Phase 0 — setup.** Install the official Sui agent skills pack (`npx skills add mystenlabs/skills --all`) and read SKILL.md before writing any Move code. Stand up Testnet wallet, faucet access, and an Enoki project with Google OAuth configured. Scaffold the monorepo layout described in SKILL.md.

**Phase 1 — personal commitment loop.** `sparky::admin` (caps + config), `sparky::goal`, `sparky::commitment` (stake escrow, success/failure paths), Community Pool deposit-only (no redistribution yet). Frontend: create goal, stake, check in, see personal result. Verifier worker: rules-and-classifier stages only, LLM stage stubbed. No betting yet — this phase alone should fully prove the Operator-Uplift-style loop end to end on Testnet.

**Phase 2 — prediction market layer.** `sparky::market` (pari-mutuel pool, bet placement, lock, resolve, claim) wired to the same goal resolution event from Phase 1. Frontend: public goal feed, place a bet, live implied odds, claim winnings. This is the phase where the self-bet ban and the zero-liquidity edge cases (Section 7) need real tests, not just code review.

**Phase 3 — verifier completion and Community Pool redistribution.** Add the LLM escalation path to the verifier worker with real dispute-flag heuristics. Implement the Community Pool's epoch computation and claim publishing. Add basic fraud-pattern monitoring (Section 9).

**Phase 4 — polish and social surface.** Profile pages, streaks/honor rate, notifications, market discovery/sorting, basic analytics dashboard for the founder. This is also the right phase to revisit native mobile and to do the Walrus research pass.

**Phase 5 — enterprise stretch (post-MVP).** Org accounts, SSO, squads/leaderboards, manager dashboards — the Operator Uplift "Enterprise" tier equivalent. Do not start this before Phases 1–4 are proven; it's explicitly out of MVP scope.

## 13. Success metrics for the MVP

- A user can go from zero to a settled goal (success or forfeiture) entirely through the app, with no manual intervention, using only Google sign-in.
- At least one goal accumulates real third-party bets on both sides and resolves to a correct, claimable payout with the pari-mutuel math holding up under the zero-liquidity edge cases.
- The verifier worker's rules-and-classifier stages handle the large majority of check-ins without needing the LLM escalation path, mirroring the cost-controlled philosophy this design borrows from Operator Uplift.
- Nothing in the MVP requires touching real money, a wallet seed phrase, or a gas prompt at any point in the user-facing flow.

## 14. Sources consulted during planning

- operatoruplift.com (home, /faq, /pricing, /docs) — reference product for the commit/stake/prove/settle loop, the AI Game Master verification philosophy, and the pricing/tier structure.
- docs.sui.io/onchain-finance/deepbookv3/deepbook and /design — DeepBook v3's CLOB, BalanceManager, Pool/PoolRegistry, and DEEP tokenomics.
- docs.sui.io/onchain-finance/deepbook-predict/ and /design — DeepBook Predict's binary-position/vertical-range model, PredictManager, OracleSVI, Vault/PLP, and its Testnet-only status.
- docs.sui.io/sui-stack/enoki/solitaire — reference architecture for zkLogin + sponsored transactions in a consumer Sui app.
- docs.sui.io/sui-stack/nautilus/ — TEE-based verifiable off-chain compute, the credible path to decentralizing the AI oracle later.
- docs.sui.io/skills — Sui Foundation's official pre-built agent skills pack for Move/Sui development.