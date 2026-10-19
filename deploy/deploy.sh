#!/usr/bin/env bash
# Deploys GB-POS to production: verifies locally, pushes to main, then on the
# server pulls, rebuilds, migrates, restarts, and health-checks. Invoke with
# `npm run deploy` from the repo root — see deploy/README.md for one-time setup.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SSH_KEY="${GB_DEPLOY_SSH_KEY:-$HOME/.ssh/golden_bites_oracle}"
SSH_HOST="${GB_DEPLOY_SSH_HOST:-ubuntu@157.137.220.21}"
REMOTE_DIR="${GB_DEPLOY_REMOTE_DIR:-/opt/golden-bites/app}"
HEALTH_URL="${GB_DEPLOY_HEALTH_URL:-http://goldenbites.duckdns.org}"
BRANCH="${GB_DEPLOY_BRANCH:-main}"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

remote() {
  ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$SSH_HOST" "$@"
}

[ -f "$SSH_KEY" ] || fail "SSH key not found at $SSH_KEY (set GB_DEPLOY_SSH_KEY to override)"

step "Checking git state"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$CURRENT_BRANCH" = "$BRANCH" ] || fail "On branch '$CURRENT_BRANCH', expected '$BRANCH'. Switch or set GB_DEPLOY_BRANCH."
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  fail "Uncommitted changes to tracked files. Commit (or stash) before deploying — deploy.sh never commits on its own."
fi

step "Killing stray backend watchers (avoids ENFILE during local tests)"
pkill -f "nest start" 2>/dev/null || true

step "Backend: typecheck, tests, build"
(cd GB-BE && npx tsc --noEmit -p tsconfig.json) || fail "Backend typecheck failed"
(cd GB-BE && npx jest --silent) || fail "Backend tests failed"
(cd GB-BE && npm run build) || fail "Backend build failed"

step "Frontend: typecheck, build"
(cd GB && npx tsc --noEmit) || fail "Frontend typecheck failed"
(cd GB && npm run build) || fail "Frontend build failed"

step "POS-ADMIN: typecheck, build"
(cd POS-ADMIN/api && npx tsc --noEmit -p tsconfig.json) || fail "POS-ADMIN API typecheck failed"
(cd POS-ADMIN/app && npm run build) || fail "POS-ADMIN app build failed"

step "Pushing $BRANCH to origin"
git push origin "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"

step "Pulling $BRANCH on the server"
remote "cd $REMOTE_DIR && git fetch origin $BRANCH && git checkout $BRANCH && git pull origin $BRANCH"

# Keys that come from this machine, sent once each (only when the server lacks them).
send_secret() { # <remote file> <name> <value>
  if [ -n "$3" ] && ! remote "grep -q '^$2=.' $REMOTE_DIR/$1 2>/dev/null"; then
    step "Sending $2 to the server (first time only)"
    printf '%s=%s\n' "$2" "$3" | remote "cd $REMOTE_DIR && umask 077 && touch $1 && sed -i '/^$2=/d' $1 && cat >> $1"
  fi
}
send_secret .env.production GOOGLE_MAPS_API_KEY \
  "${GB_GOOGLE_MAPS_API_KEY:-$(sed -n 's/^VITE_GOOGLE_MAPS_API_KEY=//p' GB/.env 2>/dev/null | tr -d '\r')}"
send_secret .env.tura.production ANTHROPIC_API_KEY \
  "${GB_TURA_ANTHROPIC_API_KEY:-$(sed -n 's/^ANTHROPIC_API_KEY=//p' TURA/api/.env 2>/dev/null | tr -d '\r')}"

step "Making sure every secret this version needs exists on the server"
# Generated there, never leaving it; existing values are never changed.
remote "bash -s -- $REMOTE_DIR" <<'SECRETS'
set -euo pipefail
cd "$1"
ENV=.env.production
rand_hex() { openssl rand -hex "$1"; }
add() { grep -q "^$1=." "$ENV" || { sed -i "/^$1=/d" "$ENV"; echo "$1=$2" >> "$ENV"; echo "  added $1"; }; }
add CREDENTIALS_ENCRYPTION_KEY "$(rand_hex 32)"
add INTERNAL_API_KEY "$(rand_hex 32)"
envval() { sed -n "s/^$1=//p" "$ENV" | tail -1; }
if [ ! -f .env.admin.production ]; then
  (umask 077; cat > .env.admin.production <<ADMINENV
ADMIN_JWT_SECRET=$(rand_hex 48)
INTERNAL_API_KEY=$(envval INTERNAL_API_KEY)
DB_PORT=$(envval DB_PORT)
DB_NAME=$(envval DB_NAME)
DB_USER=$(envval DB_USER)
DB_PASSWORD=$(envval DB_PASSWORD)
DB_SSL=false
ADMINENV
  )
  echo "  created .env.admin.production"
fi
touch .env.tura.production
grep -q '^TURA_ADMIN_KEY=' .env.tura.production || echo "TURA_ADMIN_KEY=$(rand_hex 24)" >> .env.tura.production
grep -q '^ANTHROPIC_API_KEY=.' .env.tura.production || echo "  WARNING: .env.tura.production has no ANTHROPIC_API_KEY (TURA will not answer)" >&2
SECRETS

step "Making sure the network shared with staging exists"
remote "docker network inspect gb_edge >/dev/null 2>&1 || docker network create gb_edge"

step "Rebuilding the images on the server (POS, TURA, POS-ADMIN)"
remote "cd $REMOTE_DIR && docker compose --env-file .env.production -f docker-compose.prod.yml build backend frontend tura-api tura-web admin-api admin-web"

step "Web Push keys (generated once, with the backend's own library)"
# --no-deps everywhere a one-off container runs: postgres is already up, and is never recreated.
remote "cd $REMOTE_DIR && grep -q '^VAPID_PUBLIC_KEY=.' .env.production || docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps -T backend node -e 'const k=require(\"web-push\").generateVAPIDKeys();console.log(\"VAPID_PUBLIC_KEY=\"+k.publicKey);console.log(\"VAPID_PRIVATE_KEY=\"+k.privateKey);console.log(\"VAPID_SUBJECT=mailto:soporte@goldenbites.net\")' < /dev/null | grep '^VAPID_' >> .env.production"

step "Running database migrations"
remote "cd $REMOTE_DIR && docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps backend node dist/database/migration-runner.js"

step "Syncing the permissions catalog (idempotent)"
remote "cd $REMOTE_DIR && docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps backend node dist/database/seed-runner.js"

step "Checking the new nginx config before restarting anything"
# A config nginx rejects (e.g. a certificate that isn't there) would leave the
# site down after the restart; test it in a throwaway container first, with the
# same volumes, so the running frontend is only replaced by one that starts.
remote "cd $REMOTE_DIR && docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps frontend nginx -t"   || fail "The new nginx config does not pass 'nginx -t' — nothing was restarted, the site keeps running the previous version."

step "Restarting the POS, TURA and POS-ADMIN (postgres is left untouched)"
remote "cd $REMOTE_DIR && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps backend frontend tura-api tura-web admin-api admin-web"

step "Waiting for the app to come back up"
sleep 3

step "Health check"
BACKEND_STATUS="$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' "$HEALTH_URL/api/v1/health" || echo "000")"
FRONTEND_STATUS="$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' "$HEALTH_URL/" || echo "000")"
REMOTE_SHA="$(remote "cd $REMOTE_DIR && git rev-parse HEAD")"

echo "  backend:  $BACKEND_STATUS"
echo "  frontend: $FRONTEND_STATUS"
echo "  deployed commit: $REMOTE_SHA"

if [ "$BACKEND_STATUS" != "200" ] || [ "$FRONTEND_STATUS" != "200" ]; then
  fail "Health check did not return 200 — check the server logs before trusting this deploy."
fi
for url in https://tura.goldenbites.net/tura/health https://admin.goldenbites.net/admin-api/v1/health; do
  echo "  $url: $(curl -s --max-time 8 -o /dev/null -w '%{http_code}' "$url" || echo 000)"
done
if [ "$REMOTE_SHA" != "$LOCAL_SHA" ]; then
  fail "Server HEAD ($REMOTE_SHA) does not match local HEAD ($LOCAL_SHA)."
fi

step "Deploy complete — $LOCAL_SHA is live"
