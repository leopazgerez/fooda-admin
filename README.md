# Fooda Admin

Panel de gestión de Fooda: viandas congeladas que se venden en packs de 5 menús, con una cocina (Salta) y sedes de venta.
Lo usa una sola persona, la dueña. Cubre el ciclo completo: planificar una producción, comprar los insumos, cocinar,
repartir el stock entre sedes, vender, y ver caja y ganancia del mes.

Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript, exportado como sitio estático (GitHub Pages).
Toda la data pasa por una API REST con JWT: [fooda-api](../fooda-api) (Spring Boot). Su README y su Swagger
(`http://localhost:8080/swagger-ui.html`) son el contrato.

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8080/api
npm install
npm run dev      # http://localhost:3000 — con fooda-api levantada; usuario: APP_ADMIN_* de fooda-api
npm run build    # export estático en out/ (también es el type check)
npm run lint
npm test         # node --test sobre src/lib/**/*.test.ts
npm run api:types  # regenera src/lib/api.gen.ts desde el OpenAPI (con fooda-api levantada en :8080)
```

## Estado

- **Todas las pantallas leen y escriben por la API** (`src/lib/api.ts`). No hay datos fijos en las pantallas.
- **Backend:** fooda-api. Para levantarla en local: `docker compose up -d`, `set -a; source .env.local; set +a`
  y `./mvnw spring-boot:run` en ese repo. Rutas y campos en inglés (los de la API); el texto en pantalla, en español.
- **Tipos:** `src/lib/api.gen.ts` se genera del OpenAPI de la API (`npm run api:types`) y se commitea. Si la API
  cambia, se regenera y `npm run build` marca lo que hay que ajustar. Los cuerpos de escritura no están en el
  OpenAPI: se tipan a mano en cada panel.
- **Sesión:** el access token dura poco (15 min en la API); `api.ts` lo renueva solo con el refresh token.

## Pantallas

| Menú | Ruta | Qué hace |
|---|---|---|
| Dashboard | `/dashboard` | Ventas, ganancia y caja del mes, stock por sede, avisos (compras pendientes, envases, cumpleaños, clientes para recontactar), ventas por pack y últimas producciones |
| Compras | `/compras` | Lista de compras por proveedor que genera cada producción; al registrarla queda comprada y crea el gasto. También compras sueltas y estado de envases. Cada lista pendiente se puede copiar o bajar en PDF para llevar al súper. Una compra registrada se puede anular (borra su gasto) |
| Producción | `/produccion` | Planificar (cuántos packs de cada uno), costo del lote calculado solo, recetario escalado para cocinar, PDF con todas las listas de súper pendientes, sobrantes de insumos, cierre con reparto a sedes, reabrir una cerrada y anular una planificada |
| Inventario y traslados | `/stock` | Stock por sede y lote (FIFO), despachos entre sedes (mueven el stock en el acto, se pueden anular) y ajustes (se pueden deshacer justo después de cargarlos) |
| Ventas | `/ventas` | Nueva venta (siempre cobrada completa), buscar o crear el cliente, y "Pagar con packs" (trueque o uso interno: descuenta stock sin tocar la caja). Tocar una venta abre su detalle, desde donde se anula |
| Clientes | `/clientes` | Ficha, historial de compras, recontactos y cumpleaños |
| Finanzas y caja | `/finanzas` | Resumen por mes, gastos (los manuales se pueden eliminar) y cierre de mes (fija el indirecto por pack; un mes cerrado se puede reabrir) |
| Catálogo | `/catalogo` | Insumos (con historial de precios), platos (recetas), packs (precio y versiones de composición) y proveedores |
| Análisis | `/analisis` | Resumen contra el período anterior; qué se vende y dónde; costo, ganancia y margen por pack; por qué cambió (menús, recetas, precios) y qué insumos explican el costo de cada producción; insumos que más cambiaron. Filtros de fechas, mes o semana y sede |
| Ajustes | `/ajustes` | Sedes (capacidad, umbrales, envío), parámetros, reservas y listas: tipos de gasto y motivos, y los nombres, orden y visibilidad de tipos de venta, medios de pago y unidades (`/lookups`, que usan todas las pantallas en lugar de textos fijos) |
| Mi cuenta | (tocar el nombre en el menú) | Cambiar el nombre y la contraseña |

Insumos, platos, packs, proveedores, clientes y sedes se eliminan desde su panel; si están en uso la API no lo deja y el panel muestra por qué.

Patrón común: el contenido es una lista con columnas (`ListTable`); altas y ediciones se abren en un panel
(`FormPanel`: drawer a la derecha en desktop, pantalla completa en mobile). Nada se carga en la pantalla principal.
Las pantallas con pestañas usan `?tab=` (`Tabs` + `useTab`).

## Estructura

```
src/
  app/
    layout.tsx            raíz: fuentes, metadata, FeedbackLayer (loader + toasts)
    page.tsx              redirige a /dashboard
    login/page.tsx        POST /auth/login
    (admin)/layout.tsx    AuthGuard + Sidebar: todo lo que esté acá requiere sesión
    (admin)/<pantalla>/   page.tsx + sus paneles (*Panel.tsx) y pestañas (*Tab.tsx)
  components/
    layout/               Sidebar, BottomNav, Topbar, SidebarContext (drawer mobile)
    ui/                   FormPanel, ListTable, Tabs, ConfirmModal, ApiErrorBanner, Erp (Card, Stat, Tag,
                          Field, PageHead, estilos de inputs y botones); FeedbackLayer se importa directo
  config/                 app.ts (marca), nav.ts (menú), env.ts (NEXT_PUBLIC_*)
  lib/
    api.ts                cliente HTTP: api.getOne/getAll/post/patch/put/del, ApiError, renovación de sesión
    apiQuery.ts           paginado page/size de las listas y errores
    api.gen.ts            tipos generados del OpenAPI de fooda-api (no editar a mano)
    apiTypes.ts           tipos del front que no son respuestas de la API
    etiquetas.ts          textos en español de los códigos que devuelve la API (estados, tipos de venta, …)
    useApi.ts             useApiResource, useOptions, useReloadOnWrite
    buscar.ts             búsqueda sin tildes (clientes por nombre o teléfono)
    auth.tsx, session.ts, feedback.ts, dateUtils.ts, format.ts, assets.ts
```

## Reglas de negocio principales

Las aplica fooda-api (`core/domain/` en ese repo); el front no las recalcula. Las que más condicionan la UI:

- **Ventas:** se cobran completas antes de entregar. No hay saldo ni cobros parciales. Sin precio explícito,
  cada línea toma el precio propio del pack (o el general de Parámetros).
- **Pago con packs:** descuenta stock y anota un gasto con medio "packs" valuado al precio de los packs; no resta caja.
  Uso interno descuenta stock sin gasto.
- **Costo de un lote:** directo (recetas + aceite + envases, con precios congelados al planificar; real con lo pagado)
  más indirecto (gastos tipo "fijo" del mes ÷ packs producidos). El tipo de gasto "fijo" no se puede renombrar ni borrar.
- **Stock:** sale del lote más viejo primero; los despachos lo mueven en el acto (no hay "en tránsito").
- **Packs:** la composición tiene versiones con fecha de vigencia; cada producción congela la suya.

## Agregar o cambiar una pantalla

1. Endpoint en fooda-api (con sus tests allá).
2. Tipos: `npm run api:types` con la API levantada; las pantallas importan de `@/lib/api.gen`.
3. Pantalla en `src/app/(admin)/<pantalla>/`, tomando como modelo una existente (Finanzas es la más simple):
   - Datos: `useApiResource(() => api.getOne<T>(path), [deps])` + `useReloadOnWrite(reload)`; selects con `useOptions<T>(path)`.
   - Lista: `ListTable` con `Columna<T>[]` (`hideBelow` para ocultar columnas en mobile).
   - Formulario: un `FormPanel` que se monta sólo mientras está abierto (así arranca con los datos del registro),
     envuelto en `<AnimatePresence>` de Motion para que anime al cerrarse: `<AnimatePresence>{abierto && <XPanel …/>}</AnimatePresence>`.
     En edición, PATCH con sólo los campos cambiados; un campo vaciado va como `null`.
   - Escrituras: `api.post/patch/put/del(path, body, { silent: true, success: "Texto del toast" })` con el error en
     `<ApiErrorBanner>`; `ApiError.field` dice qué campo resaltar. Sin `silent`, el error sale como toast.
   - Datos que llegan después de abrir un panel (sedes, clientes) se derivan de las props, no se copian al estado.
4. Entrada en `src/config/nav.ts`.

## Reglas por ser export estático

- Sin código de servidor: nada de route handlers, server actions, middleware ni rutas `[id]`.
- Detalles y pestañas van por query param. `useSearchParams()` tiene que estar dentro de un componente envuelto
  en `<Suspense>` (ver `ajustes/page.tsx`).
- Las rutas a archivos de `public/` pasan por `getAssetPath()`; los `<Link href>` no (Next agrega el basePath).

## Tests

`node --test` con type stripping nativo de Node (sin Jest ni bundler): los tests importan con extensión `.ts`
y sólo pueden probar módulos puros (sin alias `@/`, sin JSX). Por eso la lógica testeable vive en helpers como
`buscar.ts`, `session.ts`, `apiQuery.ts` y `etiquetas.ts`. `npm test` corre con `TZ=America/Argentina/Buenos_Aires`.

## Estilos, animaciones y fechas

- Paleta del logo de Fooda: tinta negra, fondo crema, rosa (`accent`) para botones principales y selección, y los colores
  de crayón para estados (verde ok, naranja atención, azul info, rojo error). Todo como tokens en `src/app/globals.css`
  (`bg-accent`, `text-text-secondary`, `border-border-subtle`, …), nunca hex sueltos. `src/lib/paleta.test.ts` verifica
  que los textos principales sigan cumpliendo contraste AA si se cambia un color.
- Animaciones con [Motion](https://motion.dev) (`motion/react`): paneles, confirmaciones, entrada de cada pantalla,
  pestañas y menú mobile. `MotionConfig reducedMotion="user"` en `(admin)/layout.tsx` respeta "reducir movimiento".
  Fuentes: `font-heading`/`font-body` (Inter), `font-mono` (Cousine) para cifras y códigos.
- Fechas de calendario (`YYYY-MM-DD`) se muestran tal cual con `formatDate`; instantes ISO en hora local con `formatInstant`.

## Deploy

Push a `main` dispara `.github/workflows/deploy.yml` (Node 20, `npm ci`, `npm run build`, sube `out/` a Pages).
`NEXT_PUBLIC_API_URL` sale de la variable de repo del mismo nombre (Settings → Variables): la URL pública
de fooda-api (con `/api`). Sin esa variable el sitio publicado no tiene backend. `NEXT_PUBLIC_BASE_PATH` lo informa GitHub Pages (`/fooda-admin` en github.io, vacío con dominio propio).
