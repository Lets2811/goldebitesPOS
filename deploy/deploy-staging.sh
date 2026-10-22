#!/usr/bin/env bash
# Deploys the CURRENT LOCAL CODE (committed or not) to staging — a separate
# copy for demos at https://staging.goldenbites.net, on the production VM but
# sharing nothing with production: its own Compose project (gbstaging),
# database, uploads and secrets. Never commits, pushes, or touches production.
# Invoke with `npm run deploy:staging` from the repo root; see deploy/README.md.
#
# The first run also creates staging's .env (random secrets), seeds an empty
# database, and replaces the seed's default passwords with random ones, which
# it prints once and keeps on the server in $STAGING_DIR/credentials.txt.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SSH_KEY="${GB_DEPLOY_SSH_KEY:-$HOME/.ssh/golden_bites_oracle}"
SSH_HOST="${GB_DEPLOY_SSH_HOST:-ubuntu@157.137.220.21}"
STAGING_DIR="${GB_STAGING_REMOTE_DIR:-/opt/golden-bites/staging}"
STAGING_URL="${GB_STAGING_URL:-https://staging.goldenbites.net}"
TURA_STAGING_URL="${GB_TURA_STAGING_URL:-https://tura-staging.goldenbites.net}"
ADMIN_STAGING_URL="${GB_ADMIN_STAGING_URL:-https://admin-staging.goldenbites.net}"

step() { printf '\n\033[1;35m==> [staging] %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }
remote() { ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$SSH_HOST" "$@"; }

[ -f "$SSH_KEY" ] || fail "SSH key not found at $SSH_KEY (set GB_DEPLOY_SSH_KEY to override)"

# TURA's model key. It lives only in TURA's own env file on the server; it is
# sent once (when that file lacks it), from GB_TURA_ANTHROPIC_API_KEY or else
# the local TURA/api/.env.
TURA_ENV_FILE="$STAGING_DIR/.env.tura.staging"
if ! remote "grep -q '^ANTHROPIC_API_KEY=.' $TURA_ENV_FILE 2>/dev/null"; then
  step "Sending TURA's ANTHROPIC_API_KEY to the server (first time only)"
  TURA_KEY="${GB_TURA_ANTHROPIC_API_KEY:-$(sed -n 's/^ANTHROPIC_API_KEY=//p' TURA/api/.env 2>/dev/null | tr -d '\r')}"
  [ -n "$TURA_KEY" ] || fail "No ANTHROPIC_API_KEY for TURA: set GB_TURA_ANTHROPIC_API_KEY or fill it in TURA/api/.env"
  printf 'ANTHROPIC_API_KEY=%s\n' "$TURA_KEY" \
    | remote "mkdir -p $STAGING_DIR && umask 077 && touch $TURA_ENV_FILE && sed -i '/^ANTHROPIC_API_KEY=/d' $TURA_ENV_FILE && cat >> $TURA_ENV_FILE"
  unset TURA_KEY
fi

# The POS's Google Maps key (Domicilios), a build argument of the frontend.
# Sent once, from GB_GOOGLE_MAPS_API_KEY or else the local GB/.env.
ENV_FILE_REMOTE="$STAGING_DIR/.env.staging"
if ! remote "grep -q '^GOOGLE_MAPS_API_KEY=.' $ENV_FILE_REMOTE 2>/dev/null"; then
  MAPS_KEY="${GB_GOOGLE_MAPS_API_KEY:-$(sed -n 's/^VITE_GOOGLE_MAPS_API_KEY=//p' GB/.env 2>/dev/null | tr -d '\r')}"
  if [ -n "$MAPS_KEY" ]; then
    step "Sending the Google Maps key to the server (first time only)"
    printf 'GOOGLE_MAPS_API_KEY=%s\n' "$MAPS_KEY" \
      | remote "touch $ENV_FILE_REMOTE && sed -i '/^GOOGLE_MAPS_API_KEY=/d' $ENV_FILE_REMOTE && cat >> $ENV_FILE_REMOTE"
  else
    echo "  (no Google Maps key: Domicilios will show the map as not configured)"
  fi
fi

step "Packing the local code (GB, GB-BE, TURA, POS-ADMIN, compose file; no node_modules, no .env)"
# Tracked + untracked-but-not-ignored files that exist right now (a file
# deleted locally but still tracked is skipped).
FILE_LIST="$(mktemp)"
trap 'rm -f "$FILE_LIST"' EXIT
git ls-files -co --exclude-standard -- GB GB-BE TURA POS-ADMIN docker-compose.staging.yml deploy/staging \
  | while IFS= read -r file; do [ -f "$file" ] && printf '%s\n' "$file"; done > "$FILE_LIST"
echo "  $(wc -l < "$FILE_LIST" | tr -d ' ') files"

step "Uploading to $SSH_HOST:$STAGING_DIR"
remote "mkdir -p $STAGING_DIR && rm -rf $STAGING_DIR/incoming && mkdir $STAGING_DIR/incoming"
tar -czf - -T "$FILE_LIST" | remote "tar -xzf - -C $STAGING_DIR/incoming"
remote "cd $STAGING_DIR && rm -rf previous && { [ ! -d src ] || mv src previous; } && mv incoming src"

# Everything else runs on the server, as one script (arguments, no quoting games).
remote "bash -s -- $STAGING_DIR" <<'REMOTE'
set -euo pipefail
STAGING_DIR="$1"
cd "$STAGING_DIR"
ENV_FILE="$STAGING_DIR/.env.staging"
# Written only once the whole first-run setup succeeded, so an interrupted
# first deploy finishes it on the next run.
INIT_MARKER="$STAGING_DIR/.initialized"
FIRST_RUN=false
[ -f "$INIT_MARKER" ] || FIRST_RUN=true

if [ ! -f "$ENV_FILE" ]; then
  echo "==> [staging] First run: creating $ENV_FILE with random secrets"
  rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  umask 077
  cat > "$ENV_FILE" <<ENV
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1
CORS_ORIGIN=https://staging.goldenbites.net
DB_PORT=5432
DB_NAME=golden_bites_staging
DB_USER=golden_bites_staging
DB_PASSWORD=$(rand 32)
DB_POOL_MAX=5
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=5000
DB_SSL=false
JWT_ACCESS_SECRET=$(rand 48)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=$(rand 48)
JWT_REFRESH_EXPIRES_IN=7d
# Filled in after the first seed with staging's own business/branch.
CAR_SERVICE_BUSINESS_ID=00000000-0000-0000-0000-000000000000
CAR_SERVICE_BRANCH_ID=00000000-0000-0000-0000-000000000000
CASH_SESSION_MASTER_KEY=$(rand 32)
CREDENTIALS_ENCRYPTION_KEY=$(rand 48)
ENV
fi
# Added after the first deploys: encrypts third-party credentials (electronic invoicing).
if ! grep -q '^CREDENTIALS_ENCRYPTION_KEY=' "$ENV_FILE"; then
  echo "CREDENTIALS_ENCRYPTION_KEY=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48)" >> "$ENV_FILE"
fi

# TURA's own secrets (its model key arrived before this script, see above).
TURA_ENV_FILE="$STAGING_DIR/.env.tura.staging"
if ! grep -q '^TURA_ADMIN_KEY=' "$TURA_ENV_FILE"; then
  (umask 077; echo "TURA_ADMIN_KEY=$(openssl rand -hex 24)" >> "$TURA_ENV_FILE")
fi

# The internal API between this backend and POS-ADMIN: one shared key.
if ! grep -q '^INTERNAL_API_KEY=.' "$ENV_FILE"; then
  echo "INTERNAL_API_KEY=$(openssl rand -hex 32)" >> "$ENV_FILE"
fi
# POS-ADMIN's own secrets; the database is staging's (it only touches its own tables there).
ADMIN_ENV_FILE="$STAGING_DIR/.env.admin.staging"
if [ ! -f "$ADMIN_ENV_FILE" ]; then
  echo "==> [staging] First POS-ADMIN deploy: creating $ADMIN_ENV_FILE"
  envval() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
  (umask 077; cat > "$ADMIN_ENV_FILE" <<ADMINENV
ADMIN_JWT_SECRET=$(openssl rand -hex 48)
INTERNAL_API_KEY=$(envval INTERNAL_API_KEY)
DB_PORT=$(envval DB_PORT)
DB_NAME=$(envval DB_NAME)
DB_USER=$(envval DB_USER)
DB_PASSWORD=$(envval DB_PASSWORD)
DB_SSL=false
ADMINENV
  )
fi

# The Admin asks TURA for its costs (Costos de IA) with TURA's admin key: the
# same value in both files, copied from TURA's (the one that is generated).
TURA_KEY_LINE=$(grep '^TURA_ADMIN_KEY=' "$TURA_ENV_FILE" | tail -1)
if [ -n "$TURA_KEY_LINE" ] && ! grep -qxF "$TURA_KEY_LINE" "$ADMIN_ENV_FILE"; then
  (umask 077; sed -i '/^TURA_ADMIN_KEY=/d' "$ADMIN_ENV_FILE"; echo "$TURA_KEY_LINE" >> "$ADMIN_ENV_FILE")
  echo "==> [staging] Gave POS-ADMIN TURA's admin key"
fi

cp "$ENV_FILE" src/.env.staging
cp "$TURA_ENV_FILE" src/.env.tura.staging
cp "$ADMIN_ENV_FILE" src/.env.admin.staging
cd src
compose() { docker compose -p gbstaging --env-file .env.staging -f docker-compose.staging.yml "$@"; }
# This script itself arrives on stdin (ssh ... bash -s): nothing it runs may
# read stdin, or it swallows the rest of the script.
crun() { compose run --rm -T "$@" < /dev/null; }

echo "==> [staging] Making sure the network shared with production's nginx exists"
docker network inspect gb_edge >/dev/null 2>&1 || docker network create gb_edge

echo "==> [staging] Building images (takes a few minutes; shares the VM's CPU with production meanwhile)"
compose build backend frontend tura-api tura-web admin-api admin-web < /dev/null

# Added with courier push notifications: this environment's own VAPID key pair,
# generated once with the backend's web-push library.
if ! grep -q '^VAPID_PUBLIC_KEY=.' "$ENV_FILE"; then
  echo "==> [staging] Generating the Web Push (VAPID) keys"
  crun backend node -e 'const k=require("web-push").generateVAPIDKeys();console.log("VAPID_PUBLIC_KEY="+k.publicKey);console.log("VAPID_PRIVATE_KEY="+k.privateKey);console.log("VAPID_SUBJECT=mailto:soporte@goldenbites.net")'     | grep '^VAPID_' >> "$ENV_FILE"
  cp "$ENV_FILE" .env.staging
fi

echo "==> [staging] Starting the database"
compose up -d postgres < /dev/null

echo "==> [staging] Migrations"
crun backend node dist/database/migration-runner.js

echo "==> [staging] Seed (permissions; on an empty database also the demo business and admins)"
SEED_LOG="$(mktemp)"
if ! crun backend node dist/database/seed-runner.js > "$SEED_LOG" 2>&1; then
  cat "$SEED_LOG" >&2; rm -f "$SEED_LOG"; exit 1
fi
# The seed prints its default passwords; they're replaced below, don't echo them.
grep -v -i "password" "$SEED_LOG" || true
rm -f "$SEED_LOG"

if [ "$FIRST_RUN" = true ]; then
  echo "==> [staging] First run: pointing the car-service kiosk at staging's own business"
  psql_q() { compose exec -T postgres psql -U golden_bites_staging -d golden_bites_staging -Atc "$1" < /dev/null; }
  BUSINESS_ID="$(psql_q "SELECT id FROM businesses WHERE name = 'Golden Bites' LIMIT 1")"
  BRANCH_ID="$(psql_q "SELECT id FROM branches WHERE business_id = '$BUSINESS_ID' ORDER BY created_at LIMIT 1")"
  [ -n "$BUSINESS_ID" ] && [ -n "$BRANCH_ID" ] || { echo "Seeded business/branch not found" >&2; exit 1; }
  sed -i "s/^CAR_SERVICE_BUSINESS_ID=.*/CAR_SERVICE_BUSINESS_ID=$BUSINESS_ID/; s/^CAR_SERVICE_BRANCH_ID=.*/CAR_SERVICE_BRANCH_ID=$BRANCH_ID/" "$ENV_FILE"
  cp "$ENV_FILE" .env.staging
fi

echo "==> [staging] Starting backend + frontend + TURA + POS-ADMIN"
compose up -d backend frontend tura-api tura-web admin-api admin-web < /dev/null

if [ "$FIRST_RUN" = true ]; then
  echo "==> [staging] First run: replacing the seed's default passwords"
  rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  ADMIN_PW="Demo-$(rand 14)"
  SUPER_PW="Demo-$(rand 14)"
  sleep 3
  compose exec -T -e DEMO_ADMIN_PASSWORD="$ADMIN_PW" -e DEMO_SUPERADMIN_PASSWORD="$SUPER_PW" backend node - \
    < deploy/staging/set-demo-passwords.js
  umask 077
  cat > "$STAGING_DIR/credentials.txt" <<CREDS
Golden Bites — staging (https://staging.goldenbites.net)
Negocio de demostración:  admin@goldenbites.local / $ADMIN_PW
Admin (equipo Golden Bites): superadmin@goldenbitespos.local / $SUPER_PW
CREDS
  echo
  echo "------------------------------------------------------------------"
  cat "$STAGING_DIR/credentials.txt"
  echo "(guardadas en el servidor: $STAGING_DIR/credentials.txt)"
  echo "------------------------------------------------------------------"
  touch "$INIT_MARKER"
fi

echo "==> [staging] Health check (inside the staging stack)"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if compose exec -T frontend wget -qO- http://127.0.0.1/api/v1/health >/dev/null 2>&1 < /dev/null; then
    echo "  staging backend + frontend: OK"
    break
  fi
  [ "$attempt" = 10 ] && { echo "Staging did not become healthy" >&2; compose logs --tail 40 backend >&2; exit 1; }
  sleep 3
done
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if compose exec -T tura-web wget -qO- http://127.0.0.1/tura/health >/dev/null 2>&1 < /dev/null; then
    echo "  TURA (api + app): OK"
    break
  fi
  [ "$attempt" = 10 ] && { echo "TURA did not become healthy" >&2; compose logs --tail 40 tura-api >&2; exit 1; }
  sleep 3
done
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if compose exec -T admin-web wget -qO- http://127.0.0.1/admin-api/v1/health >/dev/null 2>&1 < /dev/null; then
    echo "  POS-ADMIN (api + app): OK"
    break
  fi
  [ "$attempt" = 10 ] && { echo "POS-ADMIN did not become healthy" >&2; compose logs --tail 40 admin-api >&2; exit 1; }
  sleep 3
done

cd "$STAGING_DIR" && rm -rf previous
REMOTE

step "Public check: $STAGING_URL"
STATUS="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "$STAGING_URL/api/v1/health" || echo "000")"
if [ "$STATUS" = "200" ]; then
  step "Staging is live at $STAGING_URL"
else
  echo "  $STAGING_URL answered $STATUS — staging itself is running; the public URL needs the DNS record,"
  echo "  the certificate and production's nginx forwarding (see deploy/README.md, 'Staging')."
fi
TURA_STATUS="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "$TURA_STAGING_URL/tura/health" || true)"
if [ "$TURA_STATUS" = "200" ]; then
  step "TURA is live at $TURA_STAGING_URL"
else
  echo "  $TURA_STAGING_URL answered $TURA_STATUS — TURA itself is running; the public URL needs the DNS record,"
  echo "  the certificate and production's nginx forwarding (see deploy/README.md, 'TURA en staging')."
fi
ADMIN_STATUS="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "$ADMIN_STAGING_URL/admin-api/v1/health" || true)"
if [ "$ADMIN_STATUS" = "200" ]; then
  step "POS-ADMIN is live at $ADMIN_STAGING_URL"
else
  echo "  $ADMIN_STAGING_URL answered $ADMIN_STATUS — POS-ADMIN itself is running; the public URL needs the DNS record,"
  echo "  the certificate and production's nginx forwarding (deployed with production)."
fi
