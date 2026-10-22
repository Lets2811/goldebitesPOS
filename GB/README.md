# Golden Bites Admin

Panel de administración interno para **Golden Bites**, restaurante premium de tenders de pollo en Popayán, Colombia. Cubre el ciclo completo de la operación: pedidos, cocina, caja, inventario, compras, personal, fidelización, finanzas y cumplimiento — con una identidad visual negra y dorada, tema oscuro por defecto y datos 100% mock listos para reemplazar por una API real.

> "El antojo subió de categoría."

## Stack

- **React 19 + TypeScript + Vite** — base de la aplicación.
- **Material UI (MUI) v9** — sistema de componentes, tema oscuro/claro personalizado.
- **React Router** — enrutamiento y protección de rutas por rol.
- **Zustand** — estado global por dominio, con persistencia en `localStorage`.
- **React Hook Form + Zod** — formularios y validaciones tipadas.
- **TanStack Table** — tablas de datos (ordenamiento, paginación).
- **TanStack Query** — cliente preparado para integración con API REST.
- **Recharts** — gráficas del dashboard, finanzas y analítica.
- **Lucide React** — iconografía.
- **Notistack** — sistema de notificaciones tipo toast.
- **Playwright** — pruebas automatizadas End-to-End (E2E) para los flujos críticos del sistema.

## Instalación

Requiere Node.js 20+.

```bash
npm install
cp .env.example .env.development   # ajusta VITE_API_BASE_URL si tu backend no corre en localhost:3000
```

En Windows PowerShell también puedes utilizar:

```powershell
Copy-Item .env.example .env.development
```

## Ejecución

```bash
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # typecheck (tsc -b) + build de producción a dist/
npm run preview    # sirve el build de producción localmente
npm run lint       # ESLint
npm run typecheck  # solo verificación de tipos
npm run format     # Prettier
```

## Integración con el backend (GB-BE)

Requiere el backend `GB-BE` corriendo (ver su propio README). Orden recomendado:

1. PostgreSQL disponible en `localhost:5432`.
2. `GB-BE`: `npm install && npm run migration:run && npm run seed && npm run start:dev` (API en `http://localhost:3000/api/v1`, Swagger en `/api/docs`).
3. `GB`: `npm install && npm run dev`.
4. Abrir `http://localhost:5173` e iniciar sesión con el usuario creado por `npm run seed` en el backend.

Variables de entorno (`.env.development`, ver `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Capa de integración real (ver también `INTEGRATION_STATUS.md` en la raíz del monorepo):

- `src/config/env.ts` — variables de entorno tipadas.
- `src/lib/api/` — cliente Axios centralizado (`api-client.ts`), normalización de errores (`api-error.ts`), tipos de envelope (`api-types.ts`) y almacenamiento aislado del refresh token (`token-storage.ts`). Maneja renovación automática de access token en 401 (con deduplicación de refresh concurrentes) y cierre de sesión si el refresh falla.
- `src/lib/query-client.ts` — configuración de TanStack Query (reintentos por código de estado).
- `src/lib/health/` — chequeo de conectividad con el backend (indicador discreto en el header, solo en desarrollo).
- `src/modules/auth/` — sesión real (login/logout/refresh contra `/auth/*`), `usePermissions`/`<Can>` basados en los permisos reales del JWT, y el guard de autenticación de rutas.
- `src/modules/products/` — capa API + hooks de TanStack Query para `/products`, con query key factory (`products.keys.ts`).

Los módulos restantes (Pedidos, Cocina, Caja, Inventario, Compras, Proveedores, Clientes, Fidelización, Finanzas, Personal, Checklists, Mermas, Mantenimiento, Documentos, Marketing, Analítica) siguen en mock — ver `INTEGRATION_STATUS.md` para el detalle de qué tiene endpoint real disponible en el backend y qué no.

## Pruebas E2E con Playwright

El proyecto incluye una suite de pruebas automatizadas **End-to-End (E2E)** con Playwright para validar los flujos críticos del sistema desde la perspectiva del usuario.

La configuración general se encuentra en:

```text
playwright.config.ts
```

Los escenarios de prueba están organizados dentro de:

```text
tests/
```

La primera suite de regresión automatizada corresponde al módulo de autenticación:

```text
tests/
  auth.setup.ts          # inicia sesión una vez y guarda la sesión (storageState)
  fixtures.ts            # `test` extendido con los Page Objects
  pages/                 # Page Objects (LoginPage, AppShell, ForcePasswordChangePage)
  support/               # variables de entorno, rutas de sesión y mocks de la API
  auth/
    login.spec.ts                  # formulario, credenciales y sesión
    login-redirect.spec.ts         # destino después del login
    login-errors.spec.ts           # estado de carga y errores del servidor (mocks)
    force-password-change.spec.ts  # cambio de contraseña obligatorio
    permissions.spec.ts            # menú, rutas y API según el rol
```

El seed solo trae usuarios administradores. Para probar permisos, la suite crea por API (con el admin) un cajero (`CASHIER`) y un cocinero (`KITCHEN`) de prueba la primera vez que corre; si ya existen, los reutiliza. Sus credenciales están en `.env.e2e`.

Algunos escenarios no se pueden reproducir con los datos del seed (errores del servidor, cuentas con cambio de contraseña obligatorio). En esos casos se usa `page.route()` para interceptar la API; los helpers están en `tests/support/api-mocks.ts`. Los tests nunca modifican de verdad las credenciales de los usuarios del seed.

Los tests de otros módulos arrancan ya autenticados como admin (sesión guardada por `auth.setup.ts` en `playwright/.auth/admin.json`). Los tests que deben empezar sin sesión usan `test.use({ storageState: NO_SESSION })`, como `login.spec.ts`.

### Variables de entorno de las pruebas

Las credenciales no están en el código. Copia el ejemplo y ajústalo si tu seed usa otros datos:

```bash
cp .env.e2e.example .env.e2e
```

| Variable | Uso |
| --- | --- |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | Usuario admin del seed |
| `E2E_ADMIN_NAME` | Nombre mostrado en el menú de usuario |
| `E2E_PLATFORM_ADMIN_EMAIL` / `E2E_PLATFORM_ADMIN_PASSWORD` | Admin de plataforma del seed |
| `E2E_CASHIER_EMAIL` / `E2E_CASHIER_PASSWORD` | Cajero de prueba (lo crea la suite) |
| `E2E_KITCHEN_EMAIL` / `E2E_KITCHEN_PASSWORD` | Cocinero de prueba (lo crea la suite) |
| `E2E_API_URL` (opcional) | URL de la API para preparar datos; por defecto `http://localhost:3000/api/v1` |
| `BASE_URL` (opcional) | Probar contra otro ambiente; si se define, Playwright no levanta `npm run dev` |

En CI se definen como variables de entorno del pipeline.

### Instalación de Playwright

Playwright está incluido como dependencia de desarrollo del frontend. Después de instalar las dependencias:

```bash
npm install
```

Instala los navegadores administrados por Playwright:

```bash
npx playwright install
```

La configuración actual permite ejecutar las pruebas en Chromium, Firefox y WebKit.

### Preparación del ambiente de pruebas

Las pruebas E2E requieren que los servicios utilizados por cada escenario estén disponibles.

Para preparar por primera vez el ambiente local:

1. PostgreSQL debe estar disponible en `localhost:5432`.
2. El backend `GB-BE` debe tener sus dependencias instaladas.
3. Las migraciones deben estar aplicadas.
4. El seed debe haberse ejecutado.
5. El backend debe estar activo.
6. El frontend debe estar activo.
7. Playwright puede ejecutar la suite.

Desde `GB-BE`:

```bash
npm install
npm run migration:run
npm run seed
npm run start:dev
```

La API estará disponible por defecto en:

```text
http://localhost:3000/api/v1
```

Swagger estará disponible en desarrollo en:

```text
http://localhost:3000/api/docs
```

El frontend debe tener configurado:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Desde `GB`:

```bash
npm install
npm run dev
```

El frontend estará disponible en:

```text
http://localhost:5173
```

Esta dirección corresponde también al `baseURL` por defecto de `playwright.config.ts`. Si el frontend no está corriendo, Playwright lo levanta automáticamente con `npm run dev`; el backend sí debe iniciarse a mano.

Una vez que la base de datos está preparada, normalmente no es necesario ejecutar las migraciones y el seed antes de cada corrida. Para el trabajo diario basta con iniciar el backend antes de ejecutar Playwright.

### Ejecución

Todos los comandos de Playwright deben ejecutarse desde el directorio `GB`.

Ejecutar toda la suite:

```bash
npx playwright test
```

Ejecutar únicamente en Chromium:

```bash
npx playwright test --project=chromium
```

Ejecutar mostrando el navegador:

```bash
npx playwright test --project=chromium --headed
```

### Pruebas de autenticación

Los escenarios automatizados de autenticación se encuentran en:

```text
tests/auth/login.spec.ts
```

Para ejecutar únicamente esta suite:

```bash
npx playwright test tests/auth/login.spec.ts --project=chromium
```

Para observar la ejecución en el navegador:

```bash
npx playwright test tests/auth/login.spec.ts --project=chromium --headed
```

La suite de autenticación se ampliará progresivamente para cubrir los flujos relacionados con acceso, autorización, sesión y protección de rutas.

### Reporte HTML

Playwright utiliza un reporte HTML para facilitar el análisis de las ejecuciones.

Después de ejecutar las pruebas:

```bash
npx playwright show-report
```

El reporte permite consultar pruebas ejecutadas, pruebas exitosas y fallidas, duración, errores, traces cuando estén disponibles e información útil para diagnosticar fallos.

### Flujo de trabajo recomendado

Durante el desarrollo local se recomienda mantener tres terminales abiertas:

```text
Terminal 1 — GB-BE
  npm run start:dev

Terminal 2 — GB
  npm run dev

Terminal 3 — GB
  npx playwright test --project=chromium
```

Para ejecutar únicamente la regresión de autenticación mostrando el navegador:

```bash
npx playwright test tests/auth/login.spec.ts --project=chromium --headed
```

### Organización de las pruebas

La estructura inicial es:

```text
tests/
  auth/
    login.spec.ts
```

A medida que aumente la cobertura de regresión, los escenarios deben organizarse por dominio funcional:

```text
tests/
  auth/
    login.spec.ts
  products/
  orders/
  kitchen/
  cash/
  inventory/
  customers/
```

Cada archivo debe agrupar escenarios relacionados con una misma funcionalidad y, siempre que sea posible, cada prueba debe poder ejecutarse de forma independiente.

### Buenas prácticas

- Ejecutar las pruebas E2E contra ambientes locales o de QA, no contra producción.
- No almacenar credenciales directamente en los archivos `.spec.ts`.
- No versionar archivos `.env` con información sensible.
- Mantener los tests separados por funcionalidad.
- Utilizar selectores accesibles y estables como `getByRole` y `getByLabel` cuando estén disponibles.
- Evitar dependencias innecesarias entre tests.
- Antes de modificar un test que falla, determinar si el problema pertenece al escenario automatizado, frontend, backend, datos o configuración del ambiente.
- La suite de regresión debe crecer junto con la integración real de los módulos del frontend con `GB-BE`.

## Arquitectura

```text
src/
  app/            App.tsx: providers raíz (tema MUI, React Query, Snackbar, Router)
  assets/         Recursos estáticos
  components/
    common/       Componentes reutilizables (PageHeader, DataTable, StatCard, StatusChip,
                   ConfirmDialog, EmptyState, ErrorState, LoadingSkeleton, CurrencyDisplay,
                   DateDisplay, SearchInput, FilterBar, AlertPanel, FormDrawer, DetailDrawer...)
    layout/        Sidebar colapsable, Header (buscador + notificaciones + perfil), AppLayout
    feedback/      (reservado para componentes de feedback adicionales)
  features/       Un directorio por dominio de negocio (ver tabla abajo). Cada uno con:
                   components/, pages/, mocks/, schemas/ (si aplica), types.ts, utils.ts
  hooks/          Hooks compartidos (usePermissions, ...)
  mocks/          Generadores de datos colombianos compartidos (nombres, teléfonos, barrios)
  routes/         Definición de rutas, guardas de permisos, navConfig del sidebar
  services/       Capa de servicios simulados (ej. globalSearch — índice de búsqueda global)
  store/          Stores de Zustand por dominio (persistidos en localStorage) + barrel index.ts
  theme/          Paleta de marca y tema MUI (modo oscuro por defecto)
  types/          Tipos compartidos (roles, canales, métodos de pago, unidades de medida)
  utils/          Formato de moneda/fecha es-CO, generación de ids/folios
```

### Módulos implementados

| Módulo | Ruta | Nivel de profundidad |
|---|---|---|
| Centro de operaciones | `/` | Dashboard completo con KPIs, gráficas Recharts y alertas |
| Pedidos | `/pedidos` | Tabla + Kanban, drawer de detalle, creación manual, cambio de estado, cronómetro |
| Cocina (KDS) | `/cocina` | Kitchen Display System con tarjetas grandes, checklist por producto, pantalla completa |
| Caja | `/caja` | Apertura/cierre de turno, movimientos, cuadre, historial de sesiones |
| Productos | `/productos` | CRUD conectado al backend real (`GB-BE`): nombre, SKU, precio, costo, activar/desactivar. La receta/costeo por insumo y los modificadores quedaron fuera de esta integración — ver `INTEGRATION_STATUS.md` |
| Inventario | `/inventario` | Movimientos (entrada/salida/ajuste/conteo), alertas de stock y vencimiento |
| Compras | `/compras` | Sugerencia automática por stock mínimo, órdenes de compra, recepción de mercancía |
| Proveedores | `/proveedores` | Directorio, condiciones, comparación de precios históricos |
| Clientes | `/clientes` | Segmentación, historial de compras, notas editables |
| Fidelización | `/fidelizacion` | Configuración de puntos, niveles, catálogo de recompensas, canje |
| Finanzas | `/finanzas` | KPIs por periodo, comparativo ingresos/gastos, punto de equilibrio |
| Personal | `/personal` | Ficha de empleado, calendario semanal de turnos, evaluaciones |
| Checklists | `/checklists` | Ejecución guiada de rutinas de apertura/cierre con evidencia |
| Mermas | `/mermas` | Registro de pérdidas con cálculo automático de valor e impacto diario/semanal/mensual |
| Mantenimiento | `/mantenimiento` | Equipos, garantías, historial de intervenciones |
| Documentos | `/documentos` | Cumplimiento legal/sanitario con alertas de vencimiento |
| Marketing | `/marketing` | Campañas, calendario de contenido, cupones, influencers |
| Analítica | `/analitica` | Reportes de ventas por categoría/producto/canal, márgenes, mermas, rotación |
| Configuración | `/configuracion` | Datos del negocio, impuestos, canales, permisos por rol, preferencias visuales |

Los módulos **Pedidos, Cocina, Caja, Productos e Inventario** tienen la profundidad funcional solicitada como prioridad. El resto son igualmente interactivos donde el enunciado lo pedía explícitamente (Checklists, Mermas, Fidelización, Compras) y navegables con datos realistas en los demás casos.

## Decisiones técnicas

- **Persistencia**: cada store de Zustand usa el middleware `persist` con una clave `gb-*` propia en `localStorage`. Esto simula un backend con estado durable sin necesidad de servidor.
- **Autenticación y roles**: la sesión (usuario, rol, permisos) viene del backend vía JWT (`src/modules/auth/`). `src/routes/ProtectedRoute.tsx` sigue filtrando la navegación del sidebar por módulo usando `ROLE_MODULES` (`src/types/role.ts`), mapeado desde el rol real del backend por `roleFromBackendRoleName` — es un filtro cosmético de navegación, no reemplaza la autorización real, que ocurre en el backend vía `PermissionsGuard`. Para gating fino de acciones (crear/editar/eliminar) se usa `usePermissions`/`<Can>` de `src/modules/auth/`, que lee los códigos de permiso reales del JWT.
- **Costeo de productos**: el costo de cada producto se calcula en tiempo real (`computeProductCost`) a partir de las cantidades de receta y el costo promedio de cada insumo en el store de inventario.
- **Búsqueda global**: cada store relevante registra un proveedor de búsqueda en `src/services/globalSearch.ts`.
- **Moneda y fechas**: todos los montos usan `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` y las fechas usan `Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota' })`.
- **Gráficas**: paleta categórica fija (`chartCategorical` en `src/theme/palette.ts`) asignada por entidad.
- **Tablas**: `DataTable` envuelve TanStack Table con ordenamiento y paginación consistentes.
- **Pruebas E2E**: Playwright permite validar los flujos críticos del sistema utilizando el frontend y backend reales del ambiente de desarrollo. Los escenarios se organizan por dominio dentro de `tests/`.

## Próximos pasos para conectar una API real

1. **Reemplazar los stores por llamadas HTTP**: mover progresivamente los datos mock a hooks de TanStack Query (`useQuery`/`useMutation`) contra endpoints REST.
2. **Capa de servicios**: crear servicios por dominio para centralizar las operaciones HTTP.
3. **Autenticación real**: continuar consolidando el flujo de login, sesión, JWT y permisos contra el backend.
4. **Persistencia**: retirar progresivamente `persist` de los stores de dominio una vez que el backend sea la fuente de verdad.
5. **Websockets / polling**: implementar actualizaciones en tiempo real para Cocina y Pedidos.
6. **Carga de archivos**: integrar un servicio de almacenamiento para Documentos, Proveedores y Personal.
7. **Cobertura E2E**: ampliar progresivamente la suite de Playwright para cubrir Productos, Pedidos, Cocina, Caja, Inventario y los demás flujos críticos de regresión.

## Datos mock

Los datos (productos, ingredientes, pedidos, clientes, proveedores, empleados, etc.) son ficticios pero realistas para el contexto de Popayán, Cauca: nombres y teléfonos colombianos, direcciones con barrios reales de la ciudad, precios en pesos colombianos y menú basado en el catálogo de tenders de Golden Bites (Golden Classic, BBQ, Buffalo, Honey Mustard, Mix, combos, etc.).
