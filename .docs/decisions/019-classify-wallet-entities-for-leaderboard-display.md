# ADR-019: Classify wallet entities separately from wallet labels for leaderboard display

## Status
**Accepted** — 2026-03-29

## Context
The landing already has a configurable wallet-label registry, but the gravity leaderboard still often reads like a wall of wallet addresses. We need the leaderboard to read as human-meaningful entities where possible without blocking on a fully populated production registry.

Constraints:
- production wallet labels are still incomplete
- some wallets can be identified explicitly (LP, treasury, team, bonding curve, exchange)
- many wallets will remain unlabeled for now
- the UI needs a consistent shape for both labeled and unlabeled wallets

## Options Evaluated

| Option | Pros | Cons |
|--------|------|------|
| A. Keep only one `walletLabel` string and let the UI guess | Minimal changes | Conflates display name and entity type; weak fallback behavior |
| B. Add explicit wallet entity metadata derived from registry + heuristics | Cleaner UI contract, supports badges/types, works for both labeled and unlabeled wallets | Slight API/UI expansion |
| C. Wait until production labels are fully populated | No implementation work now | Leaves the leaderboard looking raw and unfinished |

## Decision
**Option B** — add wallet entity metadata and render leaderboard rows from that richer model.

Implementation direction:
- keep the existing label registry as the canonical source of explicit names
- derive an entity `type` from known labels/env hints using simple keyword heuristics
- expose `walletDisplay`, `walletLabel`, `walletType`, and `walletShort` in leaderboard payloads
- render the leaderboard with a primary display line plus a secondary short-address line and entity badge
- use a neutral fallback type like `holder` when no stronger classification is known

## Consequences
- The leaderboard becomes more readable immediately, even before the production registry is fully populated.
- Future production wallet-label expansion plugs into the same UI/data contract.
- Entity classification remains heuristic for now and can be refined later without redesigning the page.
