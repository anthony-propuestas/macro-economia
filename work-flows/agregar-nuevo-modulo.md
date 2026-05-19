# Guía: Agregar un Nuevo Indicador Macroeconómico

Un indicador es una métrica económica que aparece en el panel lateral izquierdo (`PanelIndicadores`), se puede seleccionar para ver el mapa coroplético mundial y la gráfica por país, y sus datos se obtienen automáticamente del World Bank API via cron diario.

Indicadores actuales: `inflation`, `gdp`, `unemployment`, `debt`, `exchange`.

---

## Checklist de archivos a modificar

```
src/lib/indicators/nuevo-indicador.ts       ← 1. Crear archivo de configuración del indicador
src/lib/indicators/index.ts                 ← 2. Importar y registrar en el array indicators
src/routes/api/cron/fetch-data/+server.ts   ← 3a. Agregar al array INDICATORS del cron (SvelteKit)
functions/api/cron/fetch-data.ts            ← 3b. Agregar al array INDICATORS del cron (fallback)
functions/api/macro.ts                      ← 4. Agregar a VALID_INDICATORS
```

`PanelIndicadores.svelte` itera el array `indicators`; `MapaMundo.svelte` usa `indicatorMap` (derivado automáticamente del mismo array en `index.ts`). Ambos se actualizan solos — **no requieren cambios**.

---

## Paso a paso

### 1. Crear el archivo de configuración

Crear `src/lib/indicators/nuevo-indicador.ts`:

```ts
import type { IndicatorConfig } from './index';

export const nuevoIndicador: IndicatorConfig = {
  id: 'nuevo_indicador',        // clave única en minúsculas con guion bajo
  label: 'Nombre visible',      // texto que aparece en PanelIndicadores
  code: 'XX.XXXX.XXXX.XX',     // código World Bank API — buscar en data.worldbank.org/indicator
  unit: '%',                    // unidad para el tooltip (%, USD, ratio, etc.)
  colorHigh: 'bad',             // 'bad' = rojo cuando valor es alto (inflación, desempleo)
                                // 'good' = verde cuando valor es alto (PIB, reservas)
  available: true,              // false = aparece en el panel como "pronto" sin ser clicable
};
```

**Cómo encontrar el código World Bank:**
- Ir a [data.worldbank.org/indicator](https://data.worldbank.org/indicator)
- Buscar el indicador
- El código está en la URL: `data.worldbank.org/indicator/FP.CPI.TOTL.ZG` → código `FP.CPI.TOTL.ZG`
- Verificar que el API devuelva datos: `https://api.worldbank.org/v2/country/all/indicator/XX.XXXX?format=json&per_page=5&mrv=1`

---

### 2. Registrar en el array de indicadores

[src/lib/indicators/index.ts](../src/lib/indicators/index.ts):

```ts
import { inflation }       from './inflation';
import { gdp }             from './gdp';
import { unemployment }    from './unemployment';
import { debt }            from './debt';
import { exchange }        from './exchange';
import { nuevoIndicador }  from './nuevo-indicador'; // ← agregar import

export const indicators: IndicatorConfig[] = [
  inflation,
  gdp,
  unemployment,
  debt,
  exchange,
  nuevoIndicador, // ← agregar al array
];
```

`PanelIndicadores.svelte` itera directamente sobre este array — el nuevo indicador aparecerá automáticamente en el panel lateral.

`index.ts` también exporta `indicatorMap = new Map(indicators.map(i => [i.id, i]))` — se construye del mismo array, por lo que el nuevo indicador queda disponible en `MapaMundo` sin pasos adicionales.

---

### 3. Agregar al cron de fetch

La lógica de extracción vive en `src/lib/server/fetchIndicator.ts`. Solo hay que agregar la entrada al array `INDICATORS` en **ambos** archivos que lo invocan:

**3a.** [src/routes/api/cron/fetch-data/+server.ts](../src/routes/api/cron/fetch-data/+server.ts) — ruta SvelteKit (principal):

```ts
const INDICATORS: IndicatorJob[] = [
  { id: 'inflation',       code: 'FP.CPI.TOTL.ZG'   },
  { id: 'gdp',             code: 'NY.GDP.PCAP.CD'    },
  { id: 'unemployment',    code: 'SL.UEM.TOTL.ZS'    },
  { id: 'debt',            code: 'GC.DOD.TOTL.GD.ZS' },
  { id: 'exchange',        code: 'PA.NUS.FCRF'        },
  { id: 'nuevo_indicador', code: 'XX.XXXX.XXXX.XX'   }, // ← nuevo
];
```

**3b.** [functions/api/cron/fetch-data.ts](../functions/api/cron/fetch-data.ts) — fallback de Cloudflare Pages Functions:

```ts
const INDICATORS: IndicatorJob[] = [
  // ... mismas entradas + la nueva:
  { id: 'nuevo_indicador', code: 'XX.XXXX.XXXX.XX'   }, // ← nuevo
];
```

El `id` debe coincidir **exactamente** con `IndicatorConfig.id` del paso 1. Es la clave que se guarda en la columna `indicator` de la tabla `macro_data`.

---

### 4. Agregar a VALID_INDICATORS

[functions/api/macro.ts](../functions/api/macro.ts) — array `VALID_INDICATORS`:

```ts
const VALID_INDICATORS = ['inflation', 'gdp', 'unemployment', 'debt', 'exchange', 'nuevo_indicador'];
```

Sin este cambio el endpoint `GET /api/macro?indicator=nuevo_indicador` responde `400 Indicador inválido`.

---

## Verificación

```bash
# Arrancar con bindings de Cloudflare (D1 local)
npm run dev:cf
```

> **Nota:** El endpoint `/api/macro` requiere sesión activa. Para probarlo desde el navegador, navegar a la app con sesión iniciada. Para curl, incluir la cookie de sesión: `curl -b "session=..." http://localhost:5173/api/macro?indicator=nuevo_indicador`

1. El indicador aparece en el panel lateral izquierdo con el label correcto
2. Si `available: false`, aparece con badge "pronto" y no es clicable (comportamiento esperado)
3. Si `available: true`, seleccionarlo muestra el mapa — pero el mapa estará vacío hasta que el cron corra

**Insertar datos de prueba directamente:**

```bash
npx wrangler d1 execute macro-db --local --command \
  "INSERT INTO macro_data (country_code, country_name, indicator, year, value, source, updated_at) VALUES ('USA', 'United States', 'nuevo_indicador', 2023, 5.2, 'world_bank', datetime('now'))"
```

---

## Esquema de la DB

No se requiere migración. La tabla `macro_data` acepta cualquier valor en la columna `indicator`:

```sql
-- schema.sql (referencia, no modificar)
CREATE TABLE IF NOT EXISTS macro_data (
  country_code  TEXT    NOT NULL,
  country_name  TEXT    NOT NULL,
  indicator     TEXT    NOT NULL,   -- ← acepta cualquier string
  year          INTEGER NOT NULL,
  value         REAL,
  source        TEXT,
  updated_at    TEXT    NOT NULL,
  PRIMARY KEY (country_code, indicator, year)
);
```

La clave primaria es `(country_code, indicator, year)` — el cron usa `INSERT OR REPLACE` para actualizar datos existentes sin errores.
