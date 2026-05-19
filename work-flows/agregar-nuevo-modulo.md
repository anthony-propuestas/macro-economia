# Guía: Agregar un Nuevo Indicador Macroeconómico

Un indicador es una métrica económica que aparece en el panel lateral izquierdo (`PanelIndicadores`), se puede seleccionar para ver el mapa coroplético mundial y la gráfica por país, y sus datos se obtienen automáticamente del World Bank API via cron diario.

Indicadores actuales: `inflation`, `gdp`, `unemployment`, `debt`, `exchange`.

---

## Checklist de archivos a modificar

```
src/lib/indicators/nuevo-indicador.ts   ← 1. Crear archivo de configuración del indicador
src/lib/indicators/index.ts             ← 2. Importar y registrar en el array indicators
functions/api/cron/fetch-data.ts        ← 3. Agregar al array de fetch del cron
functions/api/macro.ts                  ← 4. Agregar a VALID_INDICATORS
```

`PanelIndicadores.svelte`, `MapaMundo.svelte` y `GraficaPais.svelte` iteran sobre el array `indicators` — **no requieren cambios**.

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

---

### 3. Agregar al cron de fetch

[functions/api/cron/fetch-data.ts](../functions/api/cron/fetch-data.ts) — array `indicators` dentro de `scheduled()`:

```ts
const indicators: { code: string; id: string }[] = [
  { id: 'inflation',       code: 'FP.CPI.TOTL.ZG'   },
  { id: 'gdp',             code: 'NY.GDP.PCAP.CD'    },
  { id: 'unemployment',    code: 'SL.UEM.TOTL.ZS'    },
  { id: 'debt',            code: 'GC.DOD.TOTL.GD.ZS' },
  { id: 'exchange',        code: 'PA.NUS.FCRF'        },
  { id: 'nuevo_indicador', code: 'XX.XXXX.XXXX.XX'   }, // ← nuevo — mismo id y code que el paso 1
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

1. El indicador aparece en el panel lateral izquierdo con el label correcto
2. Si `available: false`, aparece con badge "pronto" y no es clicable (comportamiento esperado)
3. Si `available: true`, seleccionarlo muestra el mapa — pero el mapa estará vacío hasta que el cron corra

**Forzar fetch manual (datos locales):**

```bash
# Ejecutar el cron manualmente contra la DB local
npx wrangler pages dev -- vite dev
# En otra terminal, hacer una petición al endpoint del cron:
curl http://localhost:8788/api/cron/fetch-data
# (requiere que el cron esté expuesto como endpoint HTTP — si no lo está, ejecutar el script directo)
```

**Alternativa — insertar datos de prueba directamente:**

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
