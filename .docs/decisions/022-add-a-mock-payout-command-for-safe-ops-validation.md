# ADR-022: Add a mock payout command for safe worker/preflight validation

## Status
**Accepted** — 2026-03-29

## Context
The payout worker and wheel preflight now have a clear external payout-command contract, but production still lacks a real treasury sender. That means operators currently have two bad choices:
- leave payout command validation mostly theoretical
- or point tests at a real sender too early

We need a safe intermediate step that lets operators validate the real worker/preflight path without risking real transfers.

## Options Evaluated

| Option | Pros | Cons |
|--------|------|------|
| A. Keep only the example/template command | Good documentation | Not a drop-in runnable mock for worker/preflight operations |
| B. Add a mock payout command that returns valid claimed/failed JSON deterministically | Safe for ops validation, exercises the real contract, easy to swap later | Still not a real sender |
| C. Wait for the real sender only | No extra scripts | Slows down safe rollout testing |

## Decision
**Option B** — add a runnable mock payout command alongside the template.

Implementation direction:
- add `scripts/payout-command.mock.ts`
- default to a safe `failed` result unless explicitly switched to mock-claim mode
- support deterministic mock `claimed` responses with synthetic tx signatures
- document how to point `TREASURY_PAYOUT_COMMAND` at the mock during dry-run/preflight validation

## Consequences
- Operators can test the full payout command contract safely before real signing exists.
- The worker/preflight path becomes easier to validate in staging-like conditions.
- A future real sender can replace the mock command without changing the worker contract.
