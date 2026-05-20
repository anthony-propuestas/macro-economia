# Architecture

## Flujo de datos

```
┌─────────────────────────────────────────────────────────────┐
│                      INGESTA (diaria)                       │
│                                                             │
│  Cloudflare Cron  ──GET /api/cron/fetch-data?token=SECRET─► │
│                                                             │
│  fetchIndicator()  ──HTTP──►  World Bank API                │
│       │               (500 registros/página, 3 reintentos,  │
│       │                timeout 30s, backoff exponencial)     │
│       │                                                     │
│       ▼                                                     │
│   Validación (valor no null, código ISO3, año 4 dígitos)    │
│       │                                                     │
│       ▼                                                     │
│   INSERT OR REPLACE → Cloudflare D1 (lotes de 100)         │
│       │                                                     │
│       ▼                                                     │
│   fetch_log (ok/error, registros insertados, filtrados)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    LECTURA (por request)                    │
│                                                             │
│  Browser ──GET /api/macro?indicator=gdp──► SvelteKit Route  │
│                                                 │           │
│                                     Valida sesión en KV     │
│                                                 │           │
│                                       Query D1 → JSON       │
│                                                 │           │
│  Browser ◄──────────────────────────────────────┘           │
│     │                                                       │
│  Chart.js (líneas por país) + D3/TopoJSON (mapa choropleth) │
└─────────────────────────────────────────────────────────────┘
```

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 |
| Lenguaje | TypeScript 6 |
| Visualización | Chart.js 4 (líneas), D3 7 + TopoJSON (mapa) |
| Base de datos | Cloudflare D1 (SQLite distribuido) |
| Sesiones | Cloudflare KV |
| Auth | Google OAuth 2.0 |
| Deploy | Cloudflare Pages + Workers |
| Tests | Vitest 4 + jsdom |
| Build | Vite 8 |

## Cloudflare Bindings

| Binding | Tipo | Uso |
|---|---|---|
| `DB` | D1 Database | Almacena `macro_data` y `fetch_log` |
| `SESSIONS` | KV Namespace | Almacena sesiones de usuario |

Accesibles via `platform.env.<BINDING>` en rutas SvelteKit y Functions.

## Sistema de indicadores

Los indicadores se definen en `src/lib/indicators/` — un archivo `.ts` por indicador.  
`src/lib/indicators/index.ts` exporta el array `indicators[]` y el mapa `indicatorMap`.

Agregar un indicador a ese array propaga automáticamente:
- Nueva entrada en el sidebar del dashboard
- Nueva capa en el mapa choropleth
- Nueva opción en el selector de indicadores

Ver `work-flows/agregar-nuevo-modulo.md` para el proceso paso a paso.

## Rutas SvelteKit

```
src/routes/
├── +layout.server.ts     # Middleware de auth (todas las rutas excepto /login y /api/*)
├── +page.svelte          # Dashboard principal
├── login/                # Página de login
└── api/
    ├── macro/            # Datos macroeconómicos (choropleth o serie de tiempo)
    ├── cron/fetch-data/  # Ingesta desde World Bank (protegida por token)
    └── auth/
        ├── google/       # Inicia OAuth
        ├── google/callback/  # Callback OAuth
        └── logout/       # Cierra sesión
```

## Componentes frontend

| Componente | Responsabilidad |
|---|---|
| `GraficaPais` | Línea de tiempo Chart.js para un país e indicador |
| `MapaMundo` | Choropleth D3 coloreado por valor del indicador |
| `PanelIndicadores` | Sidebar con lista de indicadores disponibles |
