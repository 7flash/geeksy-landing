# ADR-036: Clarify baseline messaging in the experiment report UI

## Status
**Accepted** — 2026-03-28

## Context
The experiment report UI now supports operator-selectable baselines, but the grouped summary and variant table still read a little ambiguously when no baseline is selected or when the requested baseline is unavailable.

## Options Evaluated

### 1. Keep the current terse labels
- Pros: minimal UI text
- Cons: operators must infer why deltas are missing

### 2. Add explicit baseline-state messaging in the UI
- Pros: clearer operator interpretation, no API changes
- Cons: slightly more UI copy

### 3. Push baseline-state logic into the API
- Pros: centralized phrasing
- Cons: unnecessary for a client-side interpretation layer

## Decision
Clarify baseline messaging in `/admin/experiments` directly in the client UI.

Implementation direction:
- explicitly label when baseline mode is `none`
- explicitly label when a requested baseline is unavailable
- reflect the active baseline state in grouped summary copy and variant delta labeling

## Consequences
- Operators can distinguish between missing comparison data and intentionally disabled comparisons.
- The analytics API remains unchanged.
- The experiment UI becomes easier to scan for exploratory reviews.
