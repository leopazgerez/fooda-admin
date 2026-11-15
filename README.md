# Fooda Admin

Panel de gestión de Fooda: viandas congeladas que se venden en packs de 5 menús, con una cocina (Salta) y sedes de venta.
Lo usa una sola persona, la dueña. Cubre el ciclo completo: planificar una producción, comprar los insumos, cocinar,
repartir el stock entre sedes, vender, y ver caja y ganancia del mes.

Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript, exportado como sitio estático (GitHub Pages).
Toda la data pasa por una API REST con JWT. Mientras no exista el backend, la API corre simulada en el navegador.

```bash
cp .env.example .env.local   # para el prototipo: NEXT_PUBLIC_API_URL=mock
npm install
npm run dev      # http://localhost:3000 — usuario admin@fooda.com, contraseña demo
npm run build    # export estático en out/ (también es el type check)
npm run lint
npm test         # node --test sobre src/lib/**/*.test.ts
```

## Estado

- **Todas las pantallas leen y escriben por la API** (`src/lib/api.ts`). No hay datos fijos en las pantallas.
- **No hay backend todavía.** Con `NEXT_PUBLIC_API_URL=mock` responde un servidor simulado que corre en el navegador
  y guarda los datos en `localStorage` (clave `fooda_mock_v1`): cada navegador tiene sus propios datos.
  "Restaurar datos de ejemplo" (Ajustes) vuelve a los datos iniciales; ese botón solo aparece en modo simulado.
- **El backend real** tiene que responder como el mock, que es la implementación de referencia:
  el contrato lo definen `src/lib/mock/rutas-*.ts` y sus tests. Para conectarlo alcanza con cambiar
  `NEXT_PUBLIC_API_URL`; si responde con otra forma, se adapta sólo `src/lib/api.ts`.

## Pantallas

| Menú | Ruta | Qué hace |
|---|---|---|
| Dashboard | `/dashboard` | Ventas, ganancia y caja del mes, stock por sede, avisos (compras pendientes, envases, cumpleaños, clientes para recontactar), ventas por pack y últimas producciones |
| Compras | `/compras` | Lista de compras por proveedor que genera cada producción; al registrarla queda comprada y crea el gasto. También compras sueltas y estado de envases |
| Producción | `/produccion` | Planificar (cuántos packs de cada uno), costo del lote calculado solo, recetario escalado para cocinar y cierre con reparto a sedes |
| Inventario y traslados | `/stock` | Stock por sede y lote (FIFO), despachos entre sedes (mueven el stock en el acto) y ajustes |
| Ventas | `/ventas` | Nueva venta (siempre cobrada completa), buscar o crear el cliente, y "Pagar con packs" (trueque o uso interno: descuenta stock sin tocar la caja) |
| Clientes | `/clientes` | Ficha, historial de compras, recontactos y cumpleaños |
| Finanzas y caja | `/finanzas` | Resumen por mes, gastos y cierre de mes (fija el indirecto por pack) |
| Catálogo | `/catalogo` | Insumos (con historial de precios), platos (recetas), packs (precio y versiones de composición) y proveedores |
| Análisis | `/analisis` | Ventas por pack, sede y mes o semana, con los cambios de composición marcados |
| Ajustes | `/ajustes` | Sedes (capacidad, umbrales, envío), parámetros, reservas y listas (tipos de gasto, motivos) |

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
    api.ts                cliente HTTP (o el mock): api.getOne/getPage/getAll/post/patch/put/del, ApiError
    apiQuery.ts           paginado por cursor y filtros codificados para las listas
    apiTypes.ts           tipos de request/response, una sección por pantalla
    useApi.ts             useApiResource, useOptions, useReloadOnWrite
    buscar.ts             búsqueda sin tildes (clientes por nombre o teléfono)
    domain/               reglas de negocio puras y testeadas: costos, producción, stock, ventas, finanzas, clientes
    mock/                 servidor simulado: rutas-catalogo / rutas-operacion / rutas-reportes, vistas, seed, store
    auth.tsx, session.ts, feedback.ts, dateUtils.ts, format.ts, assets.ts
```

## Reglas de negocio principales

Están en `src/lib/domain/` (puras, con tests) y las aplica el mock. Las que más condicionan la UI:

- **Ventas:** se cobran completas antes de entregar. No hay saldo ni cobros parciales. Sin precio explícito,
  cada línea toma el precio propio del pack (o el general de Parámetros).
- **Pago con packs:** descuenta stock y anota un gasto con medio "packs" valuado al precio de los packs; no resta caja.
  Uso interno descuenta stock sin gasto.
- **Costo de un lote:** directo (recetas + aceite + envases, con precios congelados al planificar; real con lo pagado)
  más indirecto (gastos tipo "fijo" del mes ÷ packs producidos). El tipo de gasto "fijo" no se puede renombrar ni borrar.
- **Stock:** sale del lote más viejo primero; los despachos lo mueven en el acto (no hay "en tránsito").
- **Packs:** la composición tiene versiones con fecha de vigencia; cada producción congela la suya.

## Agregar o cambiar una pantalla

1. Endpoint implementado en `src/lib/mock/rutas-*.ts` con su test en `server.test.ts`.
   Si hay una regla de negocio, va en `src/lib/domain/` con su test.
2. Tipos en `src/lib/apiTypes.ts`.
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
y sólo pueden probar módulos puros (sin alias `@/`, sin JSX). Por eso la lógica vive en `lib/domain/`, `lib/mock/`
y helpers como `buscar.ts`. `npm test` corre con `TZ=America/Argentina/Buenos_Aires`.

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
`NEXT_PUBLIC_API_URL` sale de la variable de repo del mismo nombre (Settings → Variables): `mock` para publicar
el prototipo, o la URL del backend cuando exista. `NEXT_PUBLIC_BASE_PATH` lo informa GitHub Pages (`/fooda-admin` en github.io, vacío con dominio propio).
