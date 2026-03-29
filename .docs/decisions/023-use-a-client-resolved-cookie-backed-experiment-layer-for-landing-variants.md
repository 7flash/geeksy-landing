# ADR-023: Use a client-resolved, cookie-backed experiment layer for landing variants

## Status
**Accepted** — 2026-03-28

## Context
The landing page needs lightweight A/B testing support so we can iterate on hero messaging and CTA order without repeatedly restructuring `app/page.tsx`. The app is server-rendered, but the currently available local work should not depend on adding a full analytics vendor, external feature-flag service, or request-context-specific routing.

We also need something operators can override manually during review, and something sticky enough that a visitor keeps seeing the same variant across reloads.

## Options Evaluated

### 1. Full server-side experiment assignment with a flag service
- Pros: clean SSR consistency, central targeting, analytics-friendly
- Cons: overkill for current needs, adds infrastructure and vendor/runtime complexity

### 2. Pure query-param-only variants
- Pros: trivial to implement, easy to preview manually
- Cons: not sticky, not suitable for real visitor experiments, easy to lose on navigation

### 3. Client-resolved experiments with query override + cookie/localStorage persistence
- Pros: lightweight, no external dependency, sticky across reloads, easy manual QA via URL params, reusable for multiple page experiments
- Cons: first render defaults to control before client enhancement, assignment is not yet server-personalized, analytics must be layered on separately

## Decision
Use a small shared experiment registry in `lib/experiments.ts`.

For now:
- SSR renders the default control variant
- the client reads the experiment registry payload from the page
- assignment priority is: query override → cookie → localStorage → default variant
- the chosen variant is persisted to both cookie and localStorage
- the client updates hero copy and CTA behavior in-place after mount

This gives us a safe, dependency-free foundation for landing experiments right now while keeping the door open for later analytics/event ingestion.

## Consequences
- There may be a brief control-first render before the client applies a sticky non-control variant.
- Variant selection is intentionally simple and deterministic rather than statistically sophisticated.
- Future analytics work should record experiment + variant exposure/click events explicitly instead of coupling that concern into this first framework.
- If we later add server-aware request context or a remote flag service, this layer can become the fallback/manual override path instead of being thrown away.
