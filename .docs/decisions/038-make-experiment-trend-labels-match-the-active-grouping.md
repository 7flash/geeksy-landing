# ADR-038: Make experiment trend labels match the active grouping

## Status
**Accepted** — 2026-03-28

## Context
The experiment trend table still uses a fixed `Day` column label even when the report is grouped by week. Weekly labels are also a little too raw for quick operator scanning.

## Decision
Polish trend labeling in the admin UI without changing the analytics API.

Implementation direction:
- use a grouping-aware first column label in the trend table
- format weekly labels into a shorter, more readable display form
- keep the underlying report payload unchanged

## Consequences
- The trend table better matches the selected grouping mode.
- Operators can scan weekly reports faster.
- No backend or export contract changes are required.
