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

step "Pushing $BRANCH to origin"
git push origin "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"

step "Pulling $BRANCH on the server"
remote "cd $REMOTE_DIR && git fetch origin $BRANCH && git checkout $BRANCH && git pull origin $BRANCH"

step "Making sure the network shared with staging exists"
remote "docker network inspect gb_edge >/dev/null 2>&1 || docker network create gb_edge"

step "Rebuilding backend + frontend images on the server"
remote "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml build backend frontend"

step "Running database migrations"
remote "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml run --rm backend node dist/database/migration-runner.js"

step "Syncing the permissions catalog (idempotent)"
remote "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml run --rm backend node dist/database/seed-runner.js"

step "Checking the new nginx config before restarting anything"
# A config nginx rejects (e.g. a certificate that isn't there) would leave the
# site down after the restart; test it in a throwaway container first, with the
# same volumes, so the running frontend is only replaced by one that starts.
remote "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml run --rm --no-deps frontend nginx -t"   || fail "The new nginx config does not pass 'nginx -t' — nothing was restarted, the site keeps running the previous version."

step "Restarting backend + frontend (postgres is left untouched)"
remote "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend"

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
if [ "$REMOTE_SHA" != "$LOCAL_SHA" ]; then
  fail "Server HEAD ($REMOTE_SHA) does not match local HEAD ($LOCAL_SHA)."
fi

step "Deploy complete — $LOCAL_SHA is live"
