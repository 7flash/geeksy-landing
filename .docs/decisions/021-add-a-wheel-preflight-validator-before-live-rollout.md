# ADR-021: Add a preflight validator for treasury snapshot and payout command wiring

## Status
**Accepted** — 2026-03-29

## Context
The remaining high-risk work before the real live Phantom verification is mostly operational configuration:
- `TREASURY_SOURCE=command`
- `TREASURY_SNAPSHOT_COMMAND`
- `TREASURY_PAYOUT_COMMAND`
- treasury wallet / mint env

Today those pieces can fail only once a real request path or worker run touches them. That is too late for a calm rollout.

We need a deterministic preflight command that operators can run before the manual Phantom test to validate the command wiring and surface actionable errors early.

## Options Evaluated

| Option | Pros | Cons |
|--------|------|------|
| A. Keep validating only through live app flows | No extra code | Failures happen too late and are harder to isolate |
| B. Add a dedicated preflight script that checks env, snapshot command output, and payout command contract | Fast operator feedback, safer rollout, reusable in docs/scripts | Adds a small ops script to maintain |
| C. Build a full admin diagnostics UI first | Nice UX | Slower and more complex than needed right now |

## Decision
**Option B** — add a dedicated preflight validator script.

Implementation direction:
- add `scripts/wheel-preflight.ts`
- print current effective config and mode
- validate treasury snapshot command by executing it and parsing JSON
- validate payout command by sending a mock request payload and checking exit code + JSON contract
- support skipping payout validation when no payout command is configured
- use the script in deploy/runbook docs before the manual Phantom walkthrough

## Consequences
- Operators get a fast, explicit preflight before touching the live wheel flow.
- Misconfigured treasury commands fail earlier and with clearer messages.
- The live Phantom validation remains manual, but with much lower configuration risk.
