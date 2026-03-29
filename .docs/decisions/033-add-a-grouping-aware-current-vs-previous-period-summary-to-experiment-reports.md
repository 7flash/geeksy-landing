# ADR-033: Add a grouping-aware current-vs-previous-period summary to experiment reports

## Status
**Accepted** — 2026-03-28

## Context
The experiment report already supports grouping-aware tables and charts, but operators still need to visually infer what changed between the latest period and the one before it. We want a quick summary for the active grouping mode without expanding the API further.

## Options Evaluated

### 1. Keep only chart/table inspection
- Pros: no extra logic
- Cons: slower operator interpretation, especially in weekly mode

### 2. Add a UI-side summary comparing the latest period with the previous one
- Pros: fast to implement, uses existing trend payload, grouping-aware by design
- Cons: heuristic summary rather than full statistical analysis

### 3. Add more API-side comparison endpoints
- Pros: reusable server contract
- Cons: unnecessary expansion when the client already has the needed grouped rows

## Decision
Add a grouping-aware summary in the admin UI based on the latest and previous trend periods.

Implementation direction:
- compute the current period and previous period from the grouped trend rows already returned by the report API
- identify the current-period leader
- show current vs previous CTR deltas for the leader and control when available
- keep the summary clearly heuristic and operational, not a significance claim

## Consequences
- Operators can interpret grouped experiment results faster without losing the chart/table detail below.
- The report API stays stable because the comparison is derived client-side.
- If more rigorous period-over-period analysis is needed later, this summary can evolve without breaking the existing API.
