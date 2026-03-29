# ADR-037: Make the experiment summary card layout wrap cleanly at five cards

## Status
**Accepted** — 2026-03-28

## Context
The grouped experiment summary now includes a fifth card for baseline-state messaging. The previous fixed four-column layout becomes cramped on smaller desktop widths and makes the new explanatory copy harder to scan.

## Options Evaluated

### 1. Keep the fixed four-column grid
- Pros: simple
- Cons: cramped once the fifth card and longer copy are present

### 2. Make the summary grid responsive and let the baseline card span wider when needed
- Pros: no API changes, preserves all existing information, improves readability
- Cons: slightly more layout-specific CSS

### 3. Remove one of the cards to stay at four columns
- Pros: simpler layout
- Cons: loses useful operator context

## Decision
Keep all five cards and make the grouped summary layout responsive.

Implementation direction:
- switch the summary grid to an auto-fitting responsive layout
- allow the baseline-state card to span wider space on larger screens
- collapse cleanly to fewer columns on narrower widths

## Consequences
- Operators keep the extra baseline context without crowding the layout.
- The change stays entirely in the client UI/CSS layer.
- Future summary-card additions remain easier to accommodate.
