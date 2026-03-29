# ADR-024: Use a first-party SQLite-backed event route for experiment analytics

## Status
**Accepted** — 2026-03-28

## Context
The landing now has a lightweight experiment framework, but variant changes are not useful unless we can measure which variant was shown and which CTA was clicked.

We want analytics that:
- works immediately in the current repo without adding an external vendor
- can record experiment exposures and CTA clicks for the landing hero
- stays simple enough to inspect locally and in production
- avoids coupling measurement to the wallet/wheel backend logic

## Options Evaluated

### 1. Add a third-party analytics provider now
- Pros: dashboards and funnels out of the box
- Cons: adds dependency/vendor complexity, configuration overhead, and privacy/runtime concerns

### 2. Only log client events to the browser console
- Pros: trivial
- Cons: not durable, not measurable in production, useless for real experiment analysis

### 3. Add a small first-party event ingestion endpoint backed by SQLite
- Pros: no external dependency, durable, easy to inspect/export later, fits the current Bun/Melina app
- Cons: requires a small schema/route and does not provide dashboards by itself

## Decision
Use a first-party event ingestion route backed by SQLite.

Implementation direction:
- add an `experiment_events` table in `gravity.db`
- add a small POST route to accept experiment events
- record exposure and CTA-click events from `app/page.client.tsx`
- prefer `navigator.sendBeacon()` and fall back to `fetch(..., { keepalive: true })`
- keep the payload minimal: experiment id, variant id, event type, CTA id/label, path, referrer, timestamp, and optional client/session identifiers

## Consequences
- Experiment measurement works immediately without adding external infrastructure.
- Analytics remain private to the app/database unless later exported.
- We will likely want a follow-up reporting/export route or admin view once enough events accumulate.
