# ADR-034: Make experiment sample-threshold heuristics operator-adjustable

## Status
**Accepted** — 2026-03-28

## Context
The experiment report UI currently uses a fixed minimum exposure threshold to decide when a variant is considered sufficiently sampled for leader/warning heuristics. That is useful, but too rigid: a tiny internal test and a higher-traffic production test may need different interpretation thresholds.

## Options Evaluated

### 1. Keep one hardcoded threshold forever
- Pros: simple
- Cons: too rigid across different traffic scales

### 2. Let operators adjust the threshold in the UI and persist it locally
- Pros: flexible, no API changes, fits the existing local-ops workflow
- Cons: results become operator-tunable rather than globally fixed

### 3. Move threshold config to the server/report API
- Pros: centralized behavior
- Cons: unnecessary complexity for a heuristic that is mainly an operator interpretation aid

## Decision
Make the sample-threshold heuristic adjustable in the admin UI and persist it locally per browser.

Implementation direction:
- expose a small set of threshold options in `/admin/experiments`
- use the selected threshold for leader highlighting and low-sample warnings
- persist it in localStorage alongside the existing report UI preferences

## Consequences
- Operators can tailor heuristics to the size of the experiment they are reviewing.
- The analytics API remains unchanged because the threshold affects only UI interpretation.
- Results remain clearly heuristic rather than being mistaken for hard statistical significance.
