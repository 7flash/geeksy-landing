# ADR-030: Render experiment trends as a dependency-free SVG chart

## Status
**Accepted** — 2026-03-28

## Context
The experiment report now exposes daily trend buckets, but operators still need to scan a table to see movement. We want a faster visual summary without introducing a charting dependency or expanding the page into a much heavier analytics UI.

## Options Evaluated

### 1. Keep only the daily table
- Pros: simple and explicit
- Cons: slower to scan visually

### 2. Render a small dependency-free SVG chart from the daily buckets
- Pros: lightweight, no new package, fits the current internal analytics page
- Cons: less feature-rich than a chart library

### 3. Add a charting library now
- Pros: richer charts and interactions
- Cons: more weight and complexity than needed for the current internal tool

## Decision
Render the daily experiment trends as a simple dependency-free SVG chart.

Implementation direction:
- keep the daily table for exact values
- add an SVG trend chart above it
- draw one line/series per variant using the existing daily CTR data
- reuse the current page/report payload without changing the API contract again

## Consequences
- Operators can scan trend movement much faster while still having the exact daily table below.
- The page stays lightweight and dependency-free.
- If richer analytics visualization is needed later, this SVG chart can be replaced without affecting the report API.
