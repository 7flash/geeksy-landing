# ADR-025: Expose experiment reporting through a simple JSON/CSV API

## Status
**Accepted** — 2026-03-28

## Context
The landing now records experiment exposures and CTA clicks, but operators still need a practical way to inspect results without opening SQLite manually. We want a reporting surface quickly, but we do not yet need a full admin dashboard.

## Options Evaluated

### 1. Build a full admin analytics UI now
- Pros: friendly for operators
- Cons: more design/UI work than needed for the current phase

### 2. Leave reporting as direct SQLite queries only
- Pros: no extra code
- Cons: awkward, slow for operators, and poor fit for repeated experiment review

### 3. Add a simple read API that returns JSON summaries and optional CSV export
- Pros: fast to build, scriptable, works locally and in production, easy to feed a later UI
- Cons: less polished than a dashboard

## Decision
Use a simple reporting/export API first.

Implementation direction:
- extend the experiment analytics route with GET support
- return variant-level exposure/click/CTR summary in JSON by default
- support CSV export for spreadsheet analysis
- keep the contract general enough for future experiments, not only the current hero CTA test

## Consequences
- Operators can evaluate experiments immediately with curl/browser/download tooling.
- A future admin page can consume the same report API instead of re-querying SQLite directly.
- Reporting remains intentionally minimal until there is enough usage to justify a richer analytics UI.
