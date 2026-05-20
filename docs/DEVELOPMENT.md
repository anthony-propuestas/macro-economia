# Development

## Setup inicial

```bash
git clone <repo>
cd macro-economia
npm install
```

Crear el archivo de variables de entorno locales:

```bash
cp .dev.vars.example .dev.vars   # si existe, o crear manualmente
```

Contenido mínimo de `.dev.vars`:

```env
GOOGLE_CLIENT_ID=<id-de-google-cloud-console>
GOOGLE_CLIENT_SECRET=<secret>
CRON_SECRET=<cualquier-string-aleatorio>
```

## Modos de ejecución

### Modo rápido (sin auth, sin D1 real)

```bash
npm run dev
```

SvelteKit sirve en `http://localhost:5173`. Como no hay binding KV, el middleware de auth devuelve automáticamente `dev@local` — no se necesita login. La base de datos devuelve arrays vacíos (`data: []`) porque tampoco hay D1.

### Modo completo (con wrangler, D1 y KV simulados)

```bash
npm run build
wrangler pages dev .svelte-kit/cloudflare --d1 DB=<database_id>
```

Requiere haber ejecutado el schema localmente:

```bash
wrangler d1 execute macro-db --file=schema.sql --local
```

## Comandos útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Dev server con HMR |
| `npm run build` | Build de producción en `.svelte-kit/cloudflare` |
| `npm run preview` | Previsualizar build local |
| `npm run test` | Ejecutar suite Vitest |
| `npm run check` | Type-check con svelte-check |

## Tests

```bash
npm run test
```

Los tests están en `src/lib/indicators/index.test.ts` (Vitest + jsdom).  
Verifican que los indicadores tengan códigos World Bank válidos y estén correctamente registrados en `indicatorMap`.

Al agregar un nuevo indicador, asegurarse de que los tests sigan pasando.

## Agregar un nuevo indicador

Ver la guía completa en [work-flows/agregar-nuevo-modulo.md](../work-flows/agregar-nuevo-modulo.md).

Resumen:
1. Crear `src/lib/indicators/<nombre>.ts` con el objeto `IndicatorConfig`
2. Exportarlo desde `src/lib/indicators/index.ts`
3. El sidebar, mapa y selector se actualizan automáticamente

## Convenciones

- Archivos de indicadores: objeto `const` exportado, tipado con `IndicatorConfig`
- Rutas API: un archivo `+server.ts` por endpoint, sin lógica de negocio inline — usar `src/lib/server/`
- Código World Bank: formato `XX.YYY.ZZZ.WW` (ej: `FP.CPI.TOTL.ZG`)
- Códigos de país: siempre ISO 3166-1 alpha-3 en mayúsculas (ej: `MEX`)
- Timestamps: siempre ISO 8601 (`new Date().toISOString()`)
