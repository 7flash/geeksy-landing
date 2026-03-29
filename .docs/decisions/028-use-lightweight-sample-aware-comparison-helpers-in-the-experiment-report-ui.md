# ADR-028: Use lightweight, sample-aware comparison helpers in the experiment report UI

## Status
**Accepted** — 2026-03-28

## Context
The `/admin/experiments` page now shows raw exposures, clicks, and CTR values, but operators still need to mentally compare rows to decide whether a variant is winning. We want faster interpretation without pretending we have a full statistical decision engine.

## Options Evaluated

### 1. Keep only raw tables
- Pros: simple and honest
- Cons: slower for operators to interpret

### 2. Add lightweight helpers: winner highlighting, delta vs control, and minimum-sample hints
- Pros: faster interpretation, easy to implement, avoids overclaiming statistical certainty
- Cons: heuristic guidance rather than rigorous experiment statistics

### 3. Add a full stats engine with significance testing and confidence intervals now
- Pros: stronger analytical rigor
- Cons: more complexity, more edge cases, and easy to misuse at the current scale

## Decision
Use lightweight, sample-aware comparison helpers first.

Implementation direction:
- treat the control variant as the baseline when present
- highlight the highest-CTR sufficiently-sampled variant as the current leader
- show CTR delta vs control for each variant
- show explicit low-sample hints when exposure counts are too small for strong conclusions

## Consequences
- Operators get faster visual guidance without overstating certainty.
- The UI remains readable and operationally useful with minimal extra logic.
- If experiment volume grows later, this layer can be replaced or supplemented with richer statistical reporting.
