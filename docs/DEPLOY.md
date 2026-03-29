# Geeksy Landing Deployment Runbook

This is the fastest safe path to push the latest landing changes to production and then verify the live Phantom wheel flow.

## Production target

- Server: `202.155.132.139`
- App dir: `/opt/geeksy-landing`
- Process: `geeksy-landing`
- Domain: `https://geeksy.xyz`
- Reverse proxy: Caddy → port `3400`

## 1. Update the server checkout

```bash
ssh root@202.155.132.139
cd /opt/geeksy-landing
git fetch origin
git status --short
git log --oneline -3
git reset --hard origin/master
```

Expected latest commits include:

- `fa83dab` `fix: add wheel flow diagnostics`
- `373e324` `fix: harden wheel signature verification`
- `406bd39` `fix: harden Phantom wallet detection and signing`

## 2. Restart the landing process

Use the safest known restart pattern for this server.

```bash
bgrun restart geeksy-landing
bgrun status geeksy-landing
```

If restart behaves oddly, verify the process is actually healthy before touching anything else:

```bash
curl -I https://geeksy.xyz
curl -s https://geeksy.xyz/api/leaderboard?limit=3 | head
```

## 3. Live Phantom test checklist

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

## 4. Inspect structured wheel logs during failures

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

## 5. Quick API spot checks from the server

If the UI is unclear, test the read endpoints directly:

```bash
curl -s https://geeksy.xyz/api/leaderboard?limit=5
curl -s "https://geeksy.xyz/api/wheel/me?wallet=<WALLET>"
curl -s "https://geeksy.xyz/api/wheel/spins?wallet=<WALLET>&limit=5"
curl -s "https://geeksy.xyz/api/wheel/claims?wallet=<WALLET>&limit=5"
```

## 6. If the wheel still fails

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
