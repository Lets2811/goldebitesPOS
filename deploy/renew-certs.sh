#!/usr/bin/env bash
# Renews the Let's Encrypt certificates (goldenbites.net and
# staging.goldenbites.net) and reloads production's nginx so it serves them.
# Runs ON THE SERVER, weekly, from the ubuntu user's crontab:
#
#   17 4 * * 1  /opt/golden-bites/app/deploy/renew-certs.sh >> /opt/golden-bites/logs/renew-certs.log 2>&1
#
# certbot only renews a certificate within 30 days of expiry, so most weeks
# this changes nothing. The reload is graceful: no request is dropped.
set -euo pipefail

APP_DIR="${GB_APP_DIR:-/opt/golden-bites/app}"
echo "=== $(date -Is) renew-certs"

docker run --rm \
  -v app_certbot_webroot:/var/www/certbot \
  -v app_certbot_certs:/etc/letsencrypt \
  certbot/certbot renew --webroot -w /var/www/certbot --non-interactive "$@"

cd "$APP_DIR"
docker compose -f docker-compose.prod.yml exec -T frontend nginx -s reload < /dev/null
echo "nginx reloaded"
