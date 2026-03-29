# ADR-032: Support day or week grouping in experiment reports

## Status
**Accepted** — 2026-03-28

## Context
The experiment report now includes daily buckets and a chart, but longer-running tests can become noisy or too dense when every row is grouped by day. Operators need a quick way to zoom out to weekly groupings without losing the current daily view.

## Options Evaluated

### 1. Keep daily grouping only
- Pros: simple and granular
- Cons: noisy for longer windows

### 2. Support a report grouping parameter for day or week and let the UI toggle it
- Pros: keeps one report API, supports both near-term debugging and longer-term review
- Cons: adds a bit more API/UI state

### 3. Create a separate weekly-only report endpoint
- Pros: explicit
- Cons: unnecessary duplication and a worse API surface

## Decision
Support a single report API with `groupBy=day|week` and let the admin UI toggle between them.

Implementation direction:
- extend analytics reporting with a grouping option
- keep `day` as the default
- allow `/admin/experiments` to switch between daily and weekly trend groupings
- keep aggregate summary behavior unchanged

## Consequences
- Operators can move between detailed and zoomed-out trend views quickly.
- The report API stays compact and reusable.
- Existing daily behavior remains the default, so current consumers do not break unexpectedly.
