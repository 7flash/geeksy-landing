# ADR-018: Use a dedicated local `bgrun` launcher with a validation-port fallback on Windows

## Status
**Accepted** — 2026-03-29

## Context
Local `bgrun` validation for `geeksy-landing` on this Windows machine has been unreliable when starting the app directly on the default landing port (`3400`). The current workaround has been:

- run through `bash -lc`
- force `BUN_PORT=3412`

That works, but it is awkward, easy to forget, and not the clean default developer path we want.

We need a repeatable local validation path that:
- still uses `bgrun`
- does not depend on manually wrapping commands in `bash -lc`
- avoids collisions with stale listeners on `3400`
- stays local/dev-focused without changing production behavior

## Options Evaluated

| Option | Pros | Cons |
|--------|------|------|
| A. Keep telling operators to use the manual `bash -lc 'BUN_PORT=3412 bun run server.ts'` workaround | No code changes | Error-prone, awkward, not self-documenting |
| B. Change the app's default port globally away from `3400` | Simple | Wrong for production and contradicts existing landing routing decisions |
| C. Add a dedicated local `bgrun` launcher that chooses a safe validation port starting from `3412` | Keeps production unchanged, preserves `bgrun`, removes shell-specific workaround | Adds a small local-dev helper script |

## Decision
**Option C** — add a dedicated local launcher script for `bgrun` validation.

Implementation direction:
- add `scripts/dev-bgrun.ts`
- default to a local validation process name separate from production
- start scanning from port `3412`
- auto-pick the first free port
- run `bgrun --force` with `BUN_PORT` set for that process
- expose it through `package.json` scripts for easy reuse

## Consequences
- Local Windows validation becomes repeatable and shell-agnostic.
- Production stays on port `3400` with no behavior change.
- Developers get an explicit supported path for local `bgrun` testing instead of relying on an ad hoc command snippet.
