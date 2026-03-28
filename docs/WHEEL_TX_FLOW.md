# Transaction-Based Gravity Wheel Design

Status: design blueprint for implementation

## Goal
Turn the current gravity wheel from a visual weighted picker into a real wallet-native mechanic:
- user connects Phantom
- user spends wheel eligibility via signed wallet action
- winner reward is expressed as a percentage of treasury
- result becomes claimable

This document describes the recommended first implementation.

---

## 1. Product Model

### Current truth
Right now the site has:
- live gravity accumulation
- LP exclusion
- weighted wheel UI
- no real spend ledger
- no claim ledger
- no treasury payout engine

### Target truth
A real spin should produce these permanent records:
- who spun
- when they spun
- how much gravity they spent
- what weighted inputs were used
- what reward percentage was drawn
- what treasury amount that maps to
- whether the reward was claimed

---

## 2. Recommended Architecture

Use a **hybrid backend-first reward system** before a full on-chain program.

### Why
A fully on-chain wheel is possible, but adds:
- smart contract/program complexity
- treasury custody complexity
- randomness/VRF complexity
- much slower iteration

### Recommended first version
1. User connects Phantom.
2. Frontend asks backend for a `spin challenge`.
3. Backend returns:
   - nonce
   - expiry
   - required gravity spend
   - current treasury snapshot id
   - message text to sign
4. User signs the message with Phantom.
5. Frontend submits signature to backend.
6. Backend verifies:
   - wallet signature
   - nonce unused
   - challenge not expired
   - wallet has enough spendable gravity
7. Backend atomically:
   - debits spendable gravity
   - writes spin record
   - computes weighted winner result / reward tier
   - writes claim entry
8. Frontend shows result.
9. User can later claim with another wallet-authenticated flow.

This gives a real wallet-native interaction without pretending the current frontend wheel is authoritative.

---

## 3. Key Design Choice: Spendable Gravity vs Total Gravity

Do **not** treat total accumulated gravity as infinitely reusable.

Recommended accounting:
- `total_gravity_earned`: lifetime accumulated gravity
- `total_gravity_spent`: gravity already consumed by spins
- `spendable_gravity = total_gravity_earned - total_gravity_spent`

### Why
This lets the UI show all 3 numbers honestly:
- earned total
- spent total
- available to spend / claim

---

## 4. Treasury Reward Model

### Reward output
Each spin should output a reward like:
- `0.25% of treasury`
- `0.5% of treasury`
- `1% of treasury`
- `5% of treasury`
- etc.

### Recommendation
Use a **tier table** rather than a direct arbitrary random percentage.

Example tier table:

| Tier | Probability | Reward % of Treasury |
| --- | ---: | ---: |
| Dust | 45% | 0.05% |
| Small | 28% | 0.10% |
| Medium | 15% | 0.25% |
| Large | 8% | 0.50% |
| Mega | 3% | 1.00% |
| Cosmic | 1% | 2.50% |

This is easier to audit and easier to tune safely.

### Important separation
There are **two different weight systems**:
1. **eligibility / spin power** — based on user gravity
2. **reward tier distribution** — based on treasury prize table

The user gravity should determine whether/how strongly the user can participate in the wheel mechanic, but the payout table should be a separate controlled system.

---

## 5. What Gravity Should Control

There are 3 viable models.

### Model A — Gravity required to spin
- every spin costs fixed gravity, e.g. `100 gravity`
- simple and easy to understand

### Model B — Gravity controls number of tickets
- more gravity spent = more tickets in a drawing
- closer to raffle semantics

### Model C — Gravity controls accessible reward bands
- higher gravity unlocks better tier probabilities
- more gameable / more complex

## Recommendation
Start with **Model A**:
- one spin costs a fixed amount of spendable gravity
- simple backend logic
- simple UI copy
- easy to audit

Then later experiment with bonus weighting for whales or streaks if needed.

---

## 6. Signature / Transaction Recommendation

The user asked for a transaction-based spin. There are two practical versions.

### Version 1 — Signed message (fastest to ship)
Phantom signs a message like:

```text
Spin Gravity Wheel
wallet=<pubkey>
nonce=<uuid>
spend=100
expiresAt=<iso>
challengeId=<id>
```

Pros:
- fastest
- no chain fees
- simplest verification

Cons:
- not literally an on-chain transaction

### Version 2 — Small on-chain transaction memo (recommended next)
User sends a minimal transaction containing:
- a memo instruction with challenge id / nonce
- optional tiny protocol fee transfer

Pros:
- truly transaction-based
- on-chain proof the spin was initiated

Cons:
- more moving parts
- needs tx confirmation handling

## Recommended rollout
- **Phase 1:** signed message
- **Phase 2:** small on-chain memo/fee transaction
- **Phase 3:** dedicated program if needed

This keeps implementation realistic.

---

## 7. Backend Data Model

Recommended new tables in SQLite.

### `wallet_gravity_ledger`
Tracks earned/spent state per wallet.

| column | type | notes |
| --- | --- | --- |
| wallet | text pk | wallet address |
| total_earned | real | accumulated from gravity worker |
| total_spent | real | gravity consumed by spins |
| spendable | real | derived or materialized |
| updated_at | integer | timestamp |

### `wheel_challenges`
One-time challenges for signature verification.

| column | type | notes |
| --- | --- | --- |
| id | text pk | challenge id |
| wallet | text | wallet address |
| nonce | text | unique nonce |
| spend_amount | real | gravity cost |
| expires_at | integer | timestamp |
| used_at | integer nullable | one-time use |
| treasury_snapshot_id | text | reward basis snapshot |
| created_at | integer | timestamp |

### `wheel_spins`
Permanent record of every spin.

| column | type | notes |
| --- | --- | --- |
| id | text pk | spin id |
| wallet | text | wallet address |
| challenge_id | text | source challenge |
| spend_amount | real | gravity spent |
| wallet_gravity_before | real | audit |
| wallet_gravity_after | real | audit |
| tier_id | text | reward tier |
| reward_bps | integer | treasury percent in basis points |
| treasury_snapshot_id | text | treasury source |
| treasury_amount_at_spin | real | reward basis |
| reward_amount | real | calculated amount |
| signature | text nullable | signed message or tx signature |
| status | text | pending/settled/claimed/void |
| created_at | integer | timestamp |

### `treasury_snapshots`
Tracks treasury basis used for reward math.

| column | type | notes |
| --- | --- | --- |
| id | text pk | snapshot id |
| token | text | reward token |
| amount | real | amount at snapshot |
| source | text | wallet/query source |
| created_at | integer | timestamp |

### `wheel_claims`
Tracks claim lifecycle.

| column | type | notes |
| --- | --- | --- |
| id | text pk | claim id |
| spin_id | text | source spin |
| wallet | text | recipient |
| amount | real | claim amount |
| token | text | token |
| status | text | pending/sent/claimed/failed |
| tx_signature | text nullable | payout tx |
| created_at | integer | timestamp |
| updated_at | integer | timestamp |

---

## 8. API Surface

Recommended routes.

### `POST /api/wheel/challenge`
Input:
```json
{ "wallet": "..." }
```
Returns:
```json
{
  "challengeId": "...",
  "message": "...",
  "nonce": "...",
  "spendAmount": 100,
  "expiresAt": 1779999999999
}
```

### `POST /api/wheel/spin`
Input:
```json
{
  "wallet": "...",
  "challengeId": "...",
  "signature": "..."
}
```
Returns:
```json
{
  "ok": true,
  "spinId": "...",
  "reward": {
    "tier": "Medium",
    "rewardBps": 25,
    "treasuryAmount": 100000,
    "rewardAmount": 250
  }
}
```

### `GET /api/wheel/me?wallet=...`
Returns wallet summary:
```json
{
  "wallet": "...",
  "totalEarned": 1234,
  "totalSpent": 300,
  "spendable": 934,
  "pendingClaims": 2,
  "claimableAmount": 42
}
```

### `POST /api/wheel/claim`
Wallet-authenticated claim initiation.

### `GET /api/wheel/spins?wallet=...`
Spin history for profile / audit.

---

## 9. Randomness Strategy

For the first real version, use a server-side committed RNG with audit trail.

### Minimal viable approach
For each spin, store:
- challenge id
- server seed hash published before outcome
- client nonce/challenge nonce
- resulting hash / random number used

Then derive tier:
```text
random = sha256(serverSeed + wallet + challengeId + nonce)
```

Map the resulting number to the reward tier table.

### Better future approach
Upgrade to:
- on-chain randomness source
- VRF oracle
- program-controlled payout logic

But that is phase 2+.

---

## 10. Treasury Source

The reward must be based on a real treasury source.

Need to define:
- treasury wallet address
- treasury token mint
- whether rewards are paid in SOL, GKSY, or another treasury asset
- whether reward uses live wallet balance or periodic snapshots

## Recommendation
Use explicit periodic treasury snapshots.

Why:
- avoids race conditions if treasury changes mid-spin
- every spin references a fixed snapshot id
- easier to audit and replay

---

## 11. UI Changes Needed

### In hero dashboard
Replace current placeholder cards with real API-backed values:
- Your Gravity
- Total Earned
- Total Spent
- Spendable Gravity
- Claimable Reward Amount

### In wheel modal
Before spin:
- show gravity cost
- show spendable balance
- disable spin if insufficient gravity
- show wallet connected state

After spin:
- show reward tier
- show treasury percentage
- show reward amount
- show pending claim state

### New claim area
Add:
- `Claim rewards` button
- claim history list
- tx links

---

## 12. Security / Integrity Requirements

Must have:
- one-time challenge nonce
- expiry on challenges
- signature verification
- atomic DB transaction for debit + spin record + claim creation
- replay protection
- treasury snapshot reference
- claim idempotency
- admin/manual recovery path for failed payouts

Should have:
- rate limiting per wallet/IP
- spin limits per interval
- audit log for every treasury-affecting action

---

## 13. Recommended Implementation Phases

### Phase A — Ledger foundation
- add DB tables
- expose `/api/wheel/me`
- back current wallet cards with real ledger values

### Phase B — Signed-message spin
- add challenge route
- add signature verification
- add spin route
- record spins + claims in DB

### Phase C — Claim flow
- add claim route
- add payout worker/manual payout flow
- render claim history in UI

### Phase D — Transaction-based spin
- replace message-sign with minimal on-chain tx or memo-based tx
- verify tx signature on backend

### Phase E — Full on-chain protocol
- if desired, migrate spin logic and/or claim logic into a dedicated program

---

## 14. Recommendation Summary

Build the wheel as:
- **wallet-authenticated**
- **backend-ledger based**
- **gravity-spend controlled**
- **treasury-snapshot rewarded**
- **claimable through a separate authenticated flow**

Do not jump directly to a full on-chain wheel program unless you explicitly want to pay the extra complexity cost now.
