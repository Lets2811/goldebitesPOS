# TURA

**Tecnología Unificada de Respuesta y Asistencia** — el asistente del POS. Un
producto aparte de `GB` y `GB-BE`: tiene su propio servicio y su propia app, y
del POS solo consume la API.

```
TURA/app (PWA móvil)  --->  TURA/api (asistente)  --->  GB-BE (API del POS)
     se vincula con un usuario del POS     usa el token de ese vínculo
```

- **`api/`** — servicio Node + Express. Recibe la conversación, decide qué
  consultar y responde por streaming. No tiene acceso a la base de datos ni
  credenciales propias del POS: cada consulta va a `GB-BE` con el token de
  quien pregunta, así que los permisos y el aislamiento por negocio los sigue
  aplicando el POS.
- **`app/`** — cliente React + Vite pensado para celular, instalable como PWA.
  No tiene login: se vincula con un usuario del POS (ver abajo).

## Vincular la app con un usuario del POS

TURA es un módulo de pago y no tiene cuentas propias: actúa como un usuario del
POS.

1. **El administrador de la plataforma habilita TURA para el negocio**, en el
   panel de plataforma, en los módulos de ese negocio. Está apagado por
   defecto (es un módulo `optIn` del catálogo de `GB-BE`).
2. **Un usuario genera su código** en el POS, en **Configuración → TURA
   (asistente)**. La sección solo existe si el negocio tiene el módulo y el
   usuario tiene el permiso `settings.manage`. El código tiene seis dígitos,
   sirve una vez y vence a los 10 minutos.
3. **Se lo dice o escribe a TURA.** La primera conversación de la app (por chat
   o por voz) es un guion fijo que solo pide ese código y lo lee con una
   expresión regular (`app/src/onboarding.ts`), sin llamar al modelo, así que
   no cuesta nada hasta que la app queda vinculada.

Al canjear el código, `GB-BE` devuelve un token de vínculo **para el usuario
que lo generó**. Se guarda en el dispositivo y se cambia por tokens de acceso
de corta duración, que son los de ese usuario (su rol y su sucursal) con menos
permisos: de los suyos, solo los de lectura que TURA usa (`dashboard.read`,
`analytics.read`, `orders.read`, `inventory.read`). Un cambio de rol llega a
TURA con el siguiente token.

El acceso se corta de inmediato si el vínculo se quita desde esa misma sección
del POS, si el usuario se desactiva o si el negocio pierde el módulo. El módulo
del POS es `GB-BE/src/modules/tura-links`.

## Correr en desarrollo

Requiere `GB-BE` corriendo en el puerto 3000.

```bash
# 1. Servicio (puerto 3100)
cd TURA/api
cp .env.example .env      # y completa ANTHROPIC_API_KEY
npm install
npm run dev

# 2. App (puerto 5174)
cd TURA/app
npm install
npm run dev
```

Abre `http://localhost:5174`. Para probar en un celular de la misma red usa la
URL "Network" que imprime Vite. El servidor de Vite hace de proxy hacia ambos
backends (`/api` → POS, `/tura` → asistente), así que no hay que configurar CORS
en desarrollo.

## Estado

Chat de texto y conversación por voz, solo lectura.

| Herramienta           | Endpoint del POS          | Qué consulta                                   | Permiso del POS |
| --------------------- | ------------------------- | ---------------------------------------------- | --------------- |
| `consultar_productos` | `GET /assistant/products` | Productos por nombre o SKU: precio, estado y existencias | `products.read` |

Cada herramienta corresponde a un solo endpoint del POS y vive en su propio
archivo en `api/src/tools/`. Para añadir una: crear el archivo con
`defineReadTool` (nombre, descripción para el modelo, permiso, parámetros y la
llamada al endpoint) y agregarla a la lista de `api/src/tools/registry.ts`.
TURA solo ofrece las que el token del usuario permite usar, y el POS vuelve a
comprobar cada llamada.

El loop del agente está en `api/src/agent/agent.service.ts`: pregunta al
modelo, ejecuta las herramientas que pide, le devuelve los resultados (un error
del POS vuelve como error de la herramienta, para que lo explique) y se detiene
a las 6 vueltas. Cada mensaje queda en `api/data/audit.jsonl` con el usuario,
las herramientas, sus parámetros, el inicio de cada resultado y los errores.

Pruebas: `npm test` en `api/` (POS y modelo simulados, sin gastar créditos).

La voz (pantalla Hablar) la oye y la dice el navegador: reconocimiento de voz
para transcribir y síntesis de voz para responder. Funciona en Chrome y Edge.

La pantalla **Costos** (`#admin` en la app) es para quien desarrolla TURA:
gasto, velocidad y lo que costaría el mismo uso en otro modelo. Se abre con
`TURA_ADMIN_KEY` y lee el registro que el servicio escribe en
`api/data/usage.jsonl` (tokens y tiempos por conversación, no su texto).

El holograma de la pantalla Hablar (`app/src/HologramAssistant.tsx`) es un campo de
partículas que se reúne en un rostro, dibujado con Three.js y React Three
Fiber. El rostro sale de una malla 3D real, convertida una sola vez en nube de
puntos con `node scripts/bake-face.mjs` (desde `app/`); la app solo carga esa
nube (`src/assets/face-cloud.bin`), nunca la malla. Para cambiar de rostro se
reemplaza el modelo en `app/scripts/models/` y se vuelve a ejecutar el script.
El modelo actual es "Infinite, 3D Head Scan" de Lee Perry-Smith
(www.triplegangers.com), con licencia Creative Commons Attribution 3.0, que
exige mantener esa atribución.

Pendiente: acciones con confirmación en pantalla, avisos proactivos, y el
despliegue (Dockerfile y entrada en `docker-compose.prod.yml`).

## Contrato del servicio

`POST /tura/chat` con `Authorization: Bearer <access token del POS>` y cuerpo
`{ "messages": [{ "role": "user" | "assistant", "content": "..." }], "mode": "chat" | "voice" }`
(`mode` es opcional; `voice` pide respuestas pensadas para escucharse). El
cliente es dueño de la conversación; el servicio no guarda estado.

Responde con server-sent events, uno por línea `data:`:

| Evento                              | Significado                           |
| ----------------------------------- | ------------------------------------- |
| `{ "type": "text", "delta": "…" }`  | Fragmento de la respuesta             |
| `{ "type": "tool", "name": "…" }`   | TURA empezó a consultar el POS        |
| `{ "type": "error", "message": "…" }` | Falló la respuesta; mensaje para mostrar |
| `{ "type": "done" }`                | Terminó la respuesta                  |

Este contrato no depende de la PWA: una app nativa o la capa de voz consumen el
mismo stream.
