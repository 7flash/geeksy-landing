# ADR-040: Use grouping-aware period labels in experiment chart tooltips

## Status
**Accepted** — 2026-03-28

## Context
The trend table and chart axis now share the same grouping-aware label formatter, but chart point tooltips still show the raw report label.

## Decision
Use the same grouping-aware trend-label formatter inside chart point tooltips.

## Consequences
- Tooltips stay consistent with the table and axis.
- Weekly chart review becomes less noisy.
- No backend changes are required.
