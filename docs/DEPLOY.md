# Geeksy Landing Deployment Runbook

This is the fastest safe path to push the latest landing changes to production and then verify the live Phantom wheel flow.

For the repeatable scripted path, use:

```bash
bash scripts/prod-rollout.sh
```

Optional host override:

```bash
bash scripts/prod-rollout.sh root@202.155.132.139
```

## Production target

- Server: `202.155.132.139`
- App dir: `/opt/geeksy-landing`
- Process: `geeksy-landing`
- Domain: `https://geeksy.xyz`
- Reverse proxy: Caddy → port `3400`

## 1. Upgrade the server to the fixed `bgrun` release first

The manual steps below are what `scripts/prod-rollout.sh` automates.

`bgrun@3.12.12` had a packaging bug: the published tarball missed `dashboard/lib/runtime.ts`, and the installed-package smoke coverage was stabilized in `3.12.15`.
Upgrade production installs to `3.12.15` or newer before restarting anything.

```bash
ssh root@202.155.132.139
npm view bgrun version
which bgrun || which bgr
bgrun --version || bgr --version
bun install -g bgrun@3.12.15
bgrun --version
```

If the machine uses a different global install path, verify the active binary after install:

```bash
which bgrun
ls -l $(which bgrun)
```

## 2. Update the server checkout

```bash
cd /opt/geeksy-landing
git fetch origin
git status --short
git log --oneline -5
git reset --hard origin/master
```

Expected latest commits include:

- `a64f0d3` `feat: show cached market snapshot status`
- `4518986` `fix: add cache-aware market SSR fallback`
- `10d3c83` `docs: add landing deployment runbook`
- `fa83dab` `fix: add wheel flow diagnostics`
- `373e324` `fix: harden wheel signature verification`
- `406bd39` `fix: harden Phantom wallet detection and signing`

## 3. Restart the landing-related processes

Use the safest known restart pattern for this server.

```bash
bgrun restart geeksy-landing
bgrun restart geeksy-gravity
bgrun geeksy-landing
bgrun geeksy-gravity
```

If restart behaves oddly, verify the process is actually healthy before touching anything else:

```bash
curl -I https://geeksy.xyz
curl -s https://geeksy.xyz/api/leaderboard?limit=3 | head
curl -s https://geeksy.xyz/api/market | head
```

## 4. Populate production wallet labels (recommended before live testing)

The leaderboard now supports readable entity names and badges (`Treasury`, `LP`, `Team`, `Bonding Curve`, `Exchange`, `Internal`).
Populate them on the server before the Phantom walkthrough so the live table reads cleanly.

Two supported paths:

### Option A — file-based registry

```bash
cd /opt/geeksy-landing
cp known-wallets.example.json known-wallets.json
nano known-wallets.json
```

Then replace the placeholder addresses with the real wallet addresses.
The app auto-loads:

- `/opt/geeksy-landing/known-wallets.json`
- or `KNOWN_WALLETS_PATH`

### Option B — env-driven labels

Set any of these on the server process env and restart:

```bash
GKSY_TREASURY_WALLET=<wallet>
GKSY_TEAM_WALLET=<wallet>
GKSY_BONDING_CURVE_WALLET=<wallet>
GKSY_EXCHANGE_WALLET=<wallet>
GKSY_LP_WALLET=<wallet>
GKSY_INTERNAL_WALLET=<wallet>
```

You can also use generic custom labels:

```bash
KNOWN_WALLET_MARKETING_WALLET=<wallet>
KNOWN_WALLET_OTC_DESK=<wallet>
```

These become labels like `MARKETING WALLET` and `OTC DESK` automatically.

### Quick verification

```bash
curl -s https://geeksy.xyz/api/leaderboard?limit=10 | head
```

Check that rows now include the expected `walletLabel`, `walletDisplay`, and `walletType` values.

## 5. Live Phantom test checklist

Open `https://geeksy.xyz` in a browser with Phantom installed.

Verify:

1. Connect Phantom
2. Open wheel modal
3. Sign the spin challenge
4. Gravity burns to `0` or expected remainder
5. Stardust increases
6. Claimable SOL updates
7. Request claim succeeds
8. Refresh and confirm claim state persists

## 6. Inspect structured wheel logs during failures

The wheel API now emits structured log lines prefixed with `[wheel]`.

Useful commands:

```bash
bgrun logs geeksy-landing --lines 200
bgrun logs geeksy-landing --lines 200 | rg "\[wheel\]"
```

Look for these events:

- `[wheel] challenge.created`
- `[wheel] challenge.error`
- `[wheel] spin.success`
- `[wheel] spin.error`
- `[wheel] claim_challenge.created`
- `[wheel] claim_challenge.error`
- `[wheel] claim.success`
- `[wheel] claim.error`

The logs include safe debugging metadata only:

- shortened wallet
- shortened challenge/request ids
- signature length + prefix
- reward tier / amount
- error message + HTTP status

## 7. Quick API spot checks from the server

If the UI is unclear, test the read endpoints directly:

```bash
curl -s https://geeksy.xyz/api/leaderboard?limit=5
curl -s "https://geeksy.xyz/api/wheel/me?wallet=<WALLET>"
curl -s "https://geeksy.xyz/api/wheel/spins?wallet=<WALLET>&limit=5"
curl -s "https://geeksy.xyz/api/wheel/claims?wallet=<WALLET>&limit=5"
```

## 8. If the wheel still fails

Use the first failing stage to narrow it down:

- connect fails → frontend Phantom detection/session issue
- challenge fails → wallet summary / gravity / treasury snapshot issue
- sign succeeds but spin fails → signature encoding or backend verification issue
- spin succeeds but UI stale → client refresh/state wiring issue
- claim fails → claim challenge/request state issue

When reporting the failure back, capture:

- exact on-screen error text
- matching `[wheel] ...` log lines
- whether `/api/wheel/me` reflects the expected post-spin state
