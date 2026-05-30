#!/usr/bin/env bash
# =============================================================================
# Atomic release-based deploy for a Next.js app served by PM2 under /opt/kadryza
#
# Why: previously the CI built `.next` IN-PLACE in the served directory
# (`rm -rf .next && npm run build`). During the build PM2 served a half-written
# `.next` (500 / ENOENT pages-manifest.json), and a concurrent manual deploy
# corrupted it outright. This script never touches the live path until an
# atomic symlink swap, and an flock serializes ALL deploys (CI + manual).
#
# Layout:
#   /opt/kadryza/<app>-releases/r-<ts>/   full app (source + node_modules + .next)
#   /opt/kadryza/<app>            -> <app>-releases/r-<ts>   (symlink = PM2 cwd)
#
# Usage: deploy-frontend.sh <app> <staging-dir> <pm2-name> <health-port>
#   e.g. deploy-frontend.sh kadryza-dashboard /tmp/kadryza-dash-deploy kadryza-dashboard 3000
# =============================================================================
set -euo pipefail

APP="${1:?app name required}"            # e.g. kadryza-dashboard
STAGING="${2:?staging dir required}"     # e.g. /tmp/kadryza-dash-deploy
PM2_NAME="${3:?pm2 name required}"       # e.g. kadryza-dashboard
HEALTH_PORT="${4:?health port required}" # e.g. 3000

BASE="/opt/kadryza"
LINK="$BASE/$APP"                        # symlink served by PM2 (its cwd)
RELEASES="$BASE/${APP}-releases"
LOCK="$BASE/.deploy-${APP}.lock"
KEEP=3

mkdir -p "$RELEASES"

# --- Serialize every deploy (CI + manual) on one host-wide lock -------------
exec 9>"$LOCK"
echo "==> Acquiring deploy lock ($LOCK)…"
flock 9
echo "==> Lock acquired."

# --- Resolve the current (live) release, if any -----------------------------
CURRENT=""
if [ -L "$LINK" ]; then
  CURRENT="$(readlink -f "$LINK")"
fi

NEW="$RELEASES/r-$(date +%Y%m%d-%H%M%S)"
echo "==> New release: $NEW"

# Seed the new release from the current one via hardlinks: instant, and
# node_modules is shared on disk until npm rewrites individual files.
if [ -n "$CURRENT" ] && [ -d "$CURRENT" ]; then
  cp -al "$CURRENT" "$NEW"
  rm -rf "$NEW/.next"        # always rebuilt fresh below
else
  mkdir -p "$NEW"
fi

# --- Sync source from the CI staging dir into the new release ---------------
echo "==> Syncing source from $STAGING"
shopt -s dotglob nullglob
for entry in "$STAGING"/*; do
  name="$(basename "$entry")"
  if [ -d "$entry" ]; then
    rm -rf "$NEW/$name"
    cp -a "$entry" "$NEW/$name"
  else
    cp -af "$entry" "$NEW/$name"
  fi
done
shopt -u dotglob nullglob

# --- Install + build entirely OFF the live path -----------------------------
cd "$NEW"
echo "==> npm install"
npm install --no-audit --no-fund

echo "==> next build"
rm -rf .next
npm run build

# --- Atomic promotion: swap the symlink in a single rename ------------------
echo "==> Promote (atomic symlink swap)"
ln -sfn "$NEW" "$LINK.tmp"
mv -Tf "$LINK.tmp" "$LINK"          # atomic rename over the existing symlink
pm2 restart "$PM2_NAME" --update-env

# --- Health check, with automatic rollback on failure -----------------------
echo "==> Health check on :$HEALTH_PORT"
ok=0
for _ in $(seq 1 10); do
  sleep 2
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$HEALTH_PORT/" || true)"
  # Any non-5xx, non-000 response means the server is up (302/401 etc. are fine).
  if [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
    ok=1
    echo "    healthy (HTTP $code)"
    break
  fi
  echo "    not ready yet (HTTP ${code:-none})…"
done

if [ "$ok" != "1" ]; then
  echo "==> ❌ Health check FAILED — rolling back"
  if [ -n "$CURRENT" ] && [ -d "$CURRENT" ]; then
    ln -sfn "$CURRENT" "$LINK.tmp"
    mv -Tf "$LINK.tmp" "$LINK"
    pm2 restart "$PM2_NAME" --update-env
    echo "    rolled back to $CURRENT"
  fi
  rm -rf "$NEW"
  exit 1
fi

# --- Cleanup: drop staging, keep the $KEEP most recent releases -------------
rm -rf "$STAGING"
ls -1dt "$RELEASES"/r-* 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "==> ✅ $APP deploy complete: $(readlink -f "$LINK")"
