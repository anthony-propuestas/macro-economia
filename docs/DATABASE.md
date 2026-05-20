# Database

Cloudflare D1 (SQLite distribuido). Binding: `DB`. Schema en `schema.sql`.

## Tablas

### `macro_data`

Almacena valores de indicadores por país y año.

```sql
CREATE TABLE IF NOT EXISTS macro_data (
  country_code  TEXT    NOT NULL,  -- ISO 3166-1 alpha-3 (ej: "MEX", "USA")
  country_name  TEXT    NOT NULL,  -- Nombre completo del país
  indicator     TEXT    NOT NULL,  -- inflation | gdp | unemployment | debt | exchange
  year          INTEGER NOT NULL,  -- Año (ej: 2023)
  value         REAL,              -- Valor numérico (null si World Bank no tiene dato)
  source        TEXT,              -- Siempre 'world_bank'
  updated_at    TEXT    NOT NULL,  -- ISO 8601 timestamp del último fetch

  PRIMARY KEY (country_code, indicator, year)
);

CREATE INDEX IF NOT EXISTS idx_country ON macro_data (country_code, indicator);
```

El `PRIMARY KEY` compuesto garantiza unicidad por país+indicador+año.  
`INSERT OR REPLACE` actualiza el valor si ya existe la combinación.

### `fetch_log`

Registro de cada ejecución del pipeline de ingesta.

```sql
CREATE TABLE IF NOT EXISTS fetch_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  indicator     TEXT,     -- Indicador procesado
  status        TEXT,     -- 'ok' o 'error'
  records       INTEGER,  -- Filas insertadas exitosamente
  filtered_out  INTEGER DEFAULT 0,  -- Filas rechazadas por validación
  error_message TEXT,     -- Mensaje de error (null si status='ok')
  fetched_at    TEXT      -- ISO 8601 timestamp
);
```

## Consultas de diagnóstico

Últimas 10 ejecuciones del cron:

```sql
SELECT * FROM fetch_log ORDER BY fetched_at DESC LIMIT 10;
```

Verificar cobertura por indicador (cuántos países tienen datos):

```sql
SELECT indicator, COUNT(DISTINCT country_code) as paises, MAX(year) as ultimo_año
FROM macro_data
GROUP BY indicator;
```

Datos de un país específico:

```sql
SELECT indicator, year, value
FROM macro_data
WHERE country_code = 'MEX'
ORDER BY indicator, year;
```

Filas insertadas vs filtradas por fetch:

```sql
SELECT indicator, SUM(records) as insertadas, SUM(filtered_out) as filtradas
FROM fetch_log
WHERE status = 'ok'
GROUP BY indicator;
```

## Migraciones

Para aplicar cambios al schema en producción:

```bash
wrangler d1 execute macro-db --file=schema.sql --remote
```

Para ejecutar SQL ad-hoc:

```bash
wrangler d1 execute macro-db --command="SELECT COUNT(*) FROM macro_data" --remote
```

En desarrollo local (simula D1):

```bash
wrangler d1 execute macro-db --file=schema.sql --local
```

## Pipeline de inserción

El pipeline (`src/lib/server/fetchIndicator.ts`) usa `db.batch()` en lotes de 100 filas para respetar los límites de D1 por request. Si un lote falla, el error se registra en `fetch_log` pero los lotes anteriores ya fueron confirmados.

**Validación antes de insertar:**
- `value !== null && typeof value === 'number'`
- `countryiso3code` cumple `/^[A-Z]{3}$/`
- `date` cumple `/^\d{4}$/`
