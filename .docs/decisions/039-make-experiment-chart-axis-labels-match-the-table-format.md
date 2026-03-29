# ADR-039: Make experiment chart axis labels match the table format

## Status
**Accepted** — 2026-03-28

## Context
The trend table now uses grouping-aware labels and shortened weekly formatting, but the SVG chart x-axis still uses a separate truncation rule. That creates unnecessary inconsistency during operator review.

## Decision
Use the same client-side trend-label formatter for the chart axis and make the chart title reflect the active grouping.

## Consequences
- Trend table and chart labels stay consistent.
- Weekly reports become easier to scan.
- No API changes are required.
