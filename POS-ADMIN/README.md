# POS-ADMIN

La administración de la plataforma Golden Bites, para el equipo de Golden Bites (no para los restaurantes): empresas, sedes, módulos, facturación electrónica (Factus), TURA y feature flags. Es un producto aparte de `GB` (el POS) y `GB-BE` (su API).

```
POS-ADMIN/app  (navegador)  --->  POS-ADMIN/api  --->  GB-BE /api/v1/internal  --->  base de datos
                                   │ sesiones del equipo
                                   └─> platform_users, platform_refresh_tokens (misma base)
```

- **`app/`** — Vite + React. Llama solo a su API (`/admin-api/v1`). Copia en `src/shared/` los componentes, el tema y los tipos que usa del POS, para no depender de `GB`.
- **`api/`** — NestJS. Hace dos cosas:
  - **Sesiones del equipo:** las cuentas están en `platform_users` (migración 088 de GB-BE) y las firma con su propia clave (`ADMIN_JWT_SECRET`). Una sesión del POS no sirve aquí ni al revés.
  - **Puente al POS:** lo que se hace sobre empresas (crear, sedes, módulos, Factus, TURA, flags) lo ejecuta la API interna de GB-BE, para que las reglas del POS (roles, permisos, catálogos) vivan en un solo lugar. Envía la clave interna (`INTERNAL_API_KEY`, la misma de GB-BE) y quién actúa (`X-Platform-User-Id`, para la auditoría del POS). Solo reenvía `/businesses*` y `/feature-flags*`.

La API interna de GB-BE (`/api/v1/internal`) responde 404 sin la clave, y el nginx público la bloquea: solo se alcanza por la red privada.

## Correr en desarrollo

Requiere GB-BE corriendo en el puerto 3000 con `INTERNAL_API_KEY` en su `.env`.

```bash
# 1. API (puerto 3200)
cd POS-ADMIN/api
cp .env.example .env   # ADMIN_JWT_SECRET, INTERNAL_API_KEY (igual a la de GB-BE) y la base de datos
npm install
npm run start:dev

# 2. App (puerto 5175)
cd POS-ADMIN/app
npm install
npm run dev
```

Abre http://localhost:5175. La cuenta inicial la crea el seed de GB-BE (`superadmin@goldenbitespos.local`).

## Desplegar

Cada parte tiene su `Dockerfile`. Para publicarla en un ambiente (una sola vez):

1. **Variables:**
   - En GB-BE: `INTERNAL_API_KEY`.
   - En `admin-api`: `ADMIN_JWT_SECRET`, la misma `INTERNAL_API_KEY`, `POS_INTERNAL_URL=http://backend:3000/api/v1/internal` y la base de datos.
2. **Compose:** servicios `admin-api` (`POS-ADMIN/api`) y `admin-web` (`POS-ADMIN/app`, con el alias de red `admin-api` resuelto) en la red del backend.
3. **DNS, certificado y nginx de producción** para `admin.goldenbites.net` → `admin-web`, como se hizo con TURA (ver `deploy/README.md`).
