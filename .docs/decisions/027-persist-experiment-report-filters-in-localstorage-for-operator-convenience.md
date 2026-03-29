# ADR-027: Persist experiment report filters in localStorage for operator convenience

## Status
**Accepted** — 2026-03-28

## Context
The new `/admin/experiments` page is useful, but operators currently need to reselect the experiment id and time window every visit. This is small friction, but it adds up for a page intended for repeated review.

## Options Evaluated

### 1. Keep filters ephemeral
- Pros: no extra logic
- Cons: repetitive operator friction on every visit/reload

### 2. Persist filters in localStorage
- Pros: simple, browser-local, no server complexity, fits the internal operator nature of the page
- Cons: preferences are device/browser-specific

### 3. Persist filters server-side per user
- Pros: portable across devices
- Cons: requires an auth/user model the app does not currently have

## Decision
Use localStorage for the experiment report page filters.

Implementation direction:
- store the selected experiment id and days window in browser localStorage
- restore them on page mount when valid
- keep the API contract unchanged

## Consequences
- Operators get a smoother repeated workflow with minimal implementation overhead.
- Preferences stay local to the current browser, which is acceptable for this internal page.
