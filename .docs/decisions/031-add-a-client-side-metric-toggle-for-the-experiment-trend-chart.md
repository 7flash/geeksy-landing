# ADR-031: Add a client-side metric toggle for the experiment trend chart

## Status
**Accepted** — 2026-03-28

## Context
The experiment trend chart currently visualizes CTR only. Operators also need to compare traffic volume and click volume over time, not just conversion quality. The existing daily payload already includes exposures and clicks, so this can be solved in the UI layer.

## Options Evaluated

### 1. Keep CTR-only chart
- Pros: simple
- Cons: hides whether a CTR change came from meaningful traffic or tiny samples

### 2. Add a client-side metric toggle using the existing daily payload
- Pros: no API expansion needed, lightweight, easy for operators to switch views
- Cons: slightly more UI state to manage

### 3. Split into multiple separate charts
- Pros: all metrics visible at once
- Cons: more visual clutter on an internal page that should stay compact

## Decision
Add a client-side metric toggle for the trend chart.

Implementation direction:
- support `ctr`, `exposures`, and `clicks`
- keep the daily table unchanged below the chart
- switch the chart scale and labels client-side from the existing report data

## Consequences
- Operators can inspect both quality and volume without leaving the page.
- The report API stays stable because the daily payload already contains the needed values.
- The chart area remains compact instead of expanding into multiple stacked charts.
