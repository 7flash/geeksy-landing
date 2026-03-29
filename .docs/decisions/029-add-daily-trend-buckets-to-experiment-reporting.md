# ADR-029: Add daily trend buckets to experiment reporting

## Status
**Accepted** — 2026-03-28

## Context
The experiment report UI now shows aggregate metrics and lightweight comparison helpers, but operators still cannot tell whether a variant lead is stable over time or just a short-window spike. We need a simple historical view without introducing a full charting library.

## Options Evaluated

### 1. Keep only aggregate summaries
- Pros: simple
- Cons: hides trend stability and can overemphasize short-term spikes

### 2. Add daily trend buckets to the report API and render them as a table
- Pros: lightweight, no external charting dependency, easy to inspect and export
- Cons: less visually rich than a chart

### 3. Add interactive charts immediately
- Pros: stronger visualization
- Cons: more UI complexity and likely more dependencies than needed right now

## Decision
Add daily trend buckets to the existing report API and render them as a simple table in `/admin/experiments`.

Implementation direction:
- extend the report payload with daily rows grouped by day and variant
- include exposures, clicks, and CTR per day
- keep the existing aggregate summary unchanged
- render the daily breakdown in the operator UI without adding chart dependencies

## Consequences
- Operators can see whether experiment performance is steady or volatile.
- The report API becomes more useful for both the browser UI and future exports.
- If richer charts are needed later, they can build on the same daily-bucket payload.
