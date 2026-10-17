# Desplegar a producción

```
npm run deploy
```

desde la raíz del repo. Eso es todo — el script (`deploy/deploy.sh`):

1. Verifica que estés en `main` y sin cambios sin commitear (nunca commitea por ti).
2. Corre typecheck + tests + build de backend y frontend localmente — si algo falla, no toca el servidor.
3. Sube `main` a `origin`.
4. Se conecta al servidor por SSH, hace `git pull`, reconstruye las imágenes de backend y frontend.
5. Corre las migraciones pendientes y sincroniza el catálogo de permisos (`seed`).
6. Reinicia backend y frontend — **nunca toca el contenedor de postgres**.
7. Verifica con un health check (`/api/v1/health` y `/`) que el commit que quedó corriendo en el servidor es el mismo que acabas de desplegar.

Si cualquier paso falla, el script se detiene ahí (`set -euo pipefail`) — no sigue a medias.

## Requisitos (una sola vez)

- La llave SSH del servidor en `~/.ssh/golden_bites_oracle` (o la ruta que pongas en `GB_DEPLOY_SSH_KEY`).
- Acceso de escritura al repo en GitHub (para el `git push`).

## Variables de entorno opcionales

Todas tienen un valor por defecto ya configurado para este proyecto — solo hace falta tocarlas si algo cambia (otro servidor, otra llave, etc.):

| Variable | Por defecto |
|---|---|
| `GB_DEPLOY_SSH_KEY` | `~/.ssh/golden_bites_oracle` |
| `GB_DEPLOY_SSH_HOST` | `ubuntu@157.137.220.21` |
| `GB_DEPLOY_REMOTE_DIR` | `/opt/golden-bites/app` |
| `GB_DEPLOY_HEALTH_URL` | `http://goldenbites.duckdns.org` |
| `GB_DEPLOY_BRANCH` | `main` |

Ejemplo para apuntar a otro servidor sin editar el script:
```
GB_DEPLOY_SSH_HOST=ubuntu@1.2.3.4 npm run deploy
```

# Staging (demostraciones)

```
npm run deploy:staging
```

Despliega **el código local tal como está** (con o sin commit) a <https://staging.goldenbites.net>: una copia aparte para demostraciones, en la misma VM que producción pero sin compartir nada con ella.

- Proyecto de Compose propio (`gbstaging`) en `/opt/golden-bites/staging`, con su **propia base de datos**, sus fotos subidas y sus secretos (`/opt/golden-bites/staging/.env.staging`, generado con valores aleatorios la primera vez).
- No commitea, no hace push y no toca producción. No corre los tests locales: es para mostrar, no para liberar.
- No publica puertos. El nginx de producción (`GB/nginx.conf`) atiende `staging.goldenbites.net` y lo reenvía por la red `gb_edge` al frontend de staging. Si staging está apagado, producción sigue igual (staging responde 502).
- La **primera vez** siembra una base vacía con el negocio de demostración y cambia las contraseñas por defecto del seed por unas aleatorias. Las imprime una vez y quedan en el servidor en `/opt/golden-bites/staging/credentials.txt`.

## Preparación (una sola vez)

1. **DNS (GoDaddy):** registro `A`, nombre `staging`, valor `157.137.220.21`.
2. **Certificado**, emitido con el webroot que ya sirve el nginx de producción (no se reinicia nada):
   ```
   docker run --rm -v app_certbot_webroot:/var/www/certbot -v app_certbot_certs:/etc/letsencrypt \
     certbot/certbot certonly --webroot -w /var/www/certbot -d staging.goldenbites.net \
     --non-interactive --agree-tos -m <correo>
   ```
3. **Desplegar producción** una vez con este `GB/nginx.conf` (trae el reenvío a staging). `deploy.sh` prueba la configuración con `nginx -t` antes de reiniciar: si el certificado faltara, se detiene sin tumbar el sitio.

## Apagar / borrar staging

```
# en el servidor, dentro de /opt/golden-bites/staging/src
docker compose -p gbstaging --env-file .env.staging -f docker-compose.staging.yml down      # apagar
docker compose -p gbstaging --env-file .env.staging -f docker-compose.staging.yml down -v   # apagar Y BORRAR su base y sus fotos
```
