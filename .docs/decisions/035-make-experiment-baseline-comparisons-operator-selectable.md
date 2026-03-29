# ADR-035: Make experiment baseline comparisons operator-selectable

## Status
**Accepted** — 2026-03-28

## Context
The experiment report UI currently compares variants against `control` when available. That works for standard A/B tests, but some operator reviews are exploratory and may not have a meaningful control variant. We want a lightweight way to reinterpret deltas without changing the reporting API.

## Options Evaluated

### 1. Keep control-only comparisons
- Pros: simple and familiar
- Cons: awkward when an experiment has no meaningful control row

### 2. Let operators choose the comparison baseline in the UI
- Pros: flexible, local, no API changes
- Cons: comparisons become interpretation aids rather than one globally fixed view

### 3. Move baseline logic into the report API
- Pros: centralized behavior
- Cons: unnecessary complexity for a UI-level heuristic

## Decision
Make baseline comparisons operator-selectable in `/admin/experiments` and persist the selection locally.

Implementation direction:
- support `control`, `leader`, or `none` baseline modes
- keep leader selection sample-aware using the existing threshold heuristic
- use the selected baseline only for UI deltas and labeling
- keep the analytics/report API unchanged

## Consequences
- Operators can interpret more experiment shapes without reshaping backend data.
- The UI remains honest because the baseline is explicitly shown and user-selected.
- If richer experiment analysis is needed later, this local comparison layer can evolve independently of the API.
