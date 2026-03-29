#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-root@202.155.132.139}"
APP_DIR="${APP_DIR:-/opt/geeksy-landing}"
BGRUN_VERSION="${BGRUN_VERSION:-3.12.13}"
LANDING_PROCESS="${LANDING_PROCESS:-geeksy-landing}"
GRAVITY_PROCESS="${GRAVITY_PROCESS:-geeksy-gravity}"
DOMAIN="${DOMAIN:-https://geeksy.xyz}"

printf '==> Rolling out %s on %s using bgrun@%s\n' "$APP_DIR" "$HOST" "$BGRUN_VERSION"

ssh "$HOST" \
  APP_DIR="$APP_DIR" \
  BGRUN_VERSION="$BGRUN_VERSION" \
  LANDING_PROCESS="$LANDING_PROCESS" \
  GRAVITY_PROCESS="$GRAVITY_PROCESS" \
  DOMAIN="$DOMAIN" \
  'bash -se' <<'REMOTE'
set -euo pipefail

printf '\n==> Active bgrun before upgrade\n'
npm view bgrun version
which bgrun || which bgr || true
bgrun --version || bgr --version || true

printf '\n==> Installing bgrun@%s\n' "$BGRUN_VERSION"
bun install -g "bgrun@${BGRUN_VERSION}"
bgrun --version
which bgrun || true

printf '\n==> Updating landing checkout in %s\n' "$APP_DIR"
cd "$APP_DIR"
git fetch origin
git status --short
git log --oneline -5
git reset --hard origin/master

printf '\n==> Restarting landing-related processes\n'
bgrun restart "$LANDING_PROCESS"
bgrun restart "$GRAVITY_PROCESS"

printf '\n==> Process summaries\n'
bgrun "$LANDING_PROCESS"
bgrun "$GRAVITY_PROCESS"

printf '\n==> Health checks\n'
curl -I "$DOMAIN"
printf '\n'
curl -s "$DOMAIN/api/leaderboard?limit=3" | head
printf '\n'
curl -s "$DOMAIN/api/market" | head
printf '\n'

printf '\n==> Recent wheel logs\n'
bgrun logs "$LANDING_PROCESS" --lines 120 | rg "\[wheel\]" || true
REMOTE

printf '\n==> Rollout script complete.\n'
printf 'Next: manually test Phantom on %s\n' "$DOMAIN"
