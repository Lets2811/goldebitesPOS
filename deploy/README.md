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

## TURA en staging

El mismo `npm run deploy:staging` despliega TURA (`TURA/README.md`) en <https://tura-staging.goldenbites.net>: su servicio (`tura-api`) y su app (`tura-web`), dentro del proyecto `gbstaging`. TURA lee el POS de staging por su API, con el token de quien pregunta.

- Sus secretos van aparte, en `/opt/golden-bites/staging/.env.tura.staging`. La primera vez el script le envía la `ANTHROPIC_API_KEY` (de la variable `GB_TURA_ANTHROPIC_API_KEY` o, si no está, de `TURA/api/.env` local) y genera un `TURA_ADMIN_KEY` aleatorio para la pantalla de costos.
- Sus registros de uso y auditoría quedan en el volumen `gbstaging_staging_tura_data`.

Preparación (una sola vez), igual que staging:

1. **DNS (GoDaddy):** registro `A`, nombre `tura-staging`, valor `157.137.220.21`.
2. **Certificado:** el mismo comando de arriba con `-d tura-staging.goldenbites.net`.
3. **nginx de producción** con este `GB/nginx.conf` (trae el reenvío a `tura-staging`).

## POS-ADMIN (equipo Golden Bites)

La administración de la plataforma es un producto aparte, en `POS-ADMIN/` (app y API propias): ver `POS-ADMIN/README.md`. GB-BE solo le expone una API interna (`/api/v1/internal`, con `INTERNAL_API_KEY`), que el nginx público bloquea. El POS ya no tiene `/plataforma`: hasta publicar POS-ADMIN en un ambiente, ese ambiente no tiene interfaz de administración.

## Apagar / borrar staging

```
# en el servidor, dentro de /opt/golden-bites/staging/src
docker compose -p gbstaging --env-file .env.staging -f docker-compose.staging.yml down      # apagar
docker compose -p gbstaging --env-file .env.staging -f docker-compose.staging.yml down -v   # apagar Y BORRAR su base y sus fotos
```
