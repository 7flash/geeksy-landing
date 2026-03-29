# ADR-020: Use a branded collectible-card style for spin social previews

## Status
**Accepted** — 2026-03-29

## Context
The landing already ships dynamic `og:image` preview generation for wheel spins, but the current card is mostly informational text on a dark background. The open task is not basic functionality anymore; it is art direction and social appeal.

We want shared spin links to feel:
- more branded
- more game-like / collectible
- more visually distinct in X, Telegram, and Discord previews

Constraints:
- previews are generated server-side as SVG
- they need to stay lightweight and deterministic
- they should still work for both a specific spin and the default non-spin card

## Options Evaluated

| Option | Pros | Cons |
|--------|------|------|
| A. Keep the current text-heavy preview | Functional, low effort | Feels generic and low-energy for a game/share card |
| B. Move to a more branded collectible-card composition with tier chip, reward spotlight, radial effects, and stat tiles | Better share appeal, stronger Geeksy identity, still feasible in SVG | Slightly more design/code complexity |
| C. Switch to raster/image assets only | Maximum design freedom | Harder to keep dynamic per-spin data and would require an image pipeline |

## Decision
**Option B** — keep SVG generation, but redesign it as a branded collectible-style card.

Implementation direction:
- use stronger layered gradients and star/glow accents
- spotlight the reward tier and treasury percentage more clearly
- include a recognizable wheel/coin motif instead of a minimal symbol
- show a cleaner metadata row for wallet / status / recorded amount
- keep copy shorter and more visual-first

## Consequences
- Social cards should look better in feeds without changing the route contract.
- The preview generator stays simple and server-native.
- Future art-direction tweaks can keep building on the same SVG route instead of replacing the metadata system.
