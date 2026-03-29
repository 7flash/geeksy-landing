# ADR-026: Add a lightweight internal experiment report page before a full admin dashboard

## Status
**Accepted** — 2026-03-28

## Context
The landing now has experiment assignment, event ingestion, and a reporting/export API. Operators still need a browser-friendly way to inspect results without manual API calls, but building a full analytics dashboard would be more work than needed right now.

## Options Evaluated

### 1. Keep only the JSON/CSV API
- Pros: already works, scriptable
- Cons: awkward for repeated operator use in the browser

### 2. Add a small internal report page backed by the existing API
- Pros: fast to ship, reuses the current report contract, good enough for experiment review
- Cons: not a full analytics product and still intentionally lightweight

### 3. Build a broader admin dashboard first
- Pros: more polished and extensible
- Cons: slower and larger than the current need

## Decision
Add a lightweight internal experiment report page first.

Implementation direction:
- add `/admin/experiments`
- let operators choose the experiment id and time window
- load the existing `/api/analytics/experiment` JSON summary
- expose CSV download using the same API
- keep the page read-only and lightweight for now

## Consequences
- Operators can inspect experiment results in the browser immediately.
- The page stays thin because reporting logic remains in the API layer.
- If analytics needs grow later, this page can either expand or be replaced by a fuller admin dashboard.
