# Indicadores y Fuentes de Datos

Referencia completa de qué indicadores existen, de qué API provienen, y los parámetros técnicos de cada fuente. Actualizar este archivo cada vez que se agregue un nuevo indicador o una nueva API.

---

## Resumen de fuentes activas

| API | Indicadores que provee | Requiere clave | Estado |
|---|---|---|---|
| World Bank Open Data | inflation, gdp, unemployment, debt, exchange | No | Activa |
| IMF DataMapper | current_account, fiscal_balance, reserves | No | No integrada |
| OECD Statistics (SDMX) | fdi_inflows | No | No integrada |

---

## World Bank Open Data API

**URL base:** `https://api.worldbank.org/v2/`

**Patrón de endpoint:**
```
GET https://api.worldbank.org/v2/country/all/indicator/{WB_CODE}
    ?format=json
    &per_page=500
    &mrv=5
    &page={N}
```

### Parámetros clave

| Parámetro | Valor | Significado |
|---|---|---|
| `format` | `json` | Formato de respuesta |
| `per_page` | `500` | Registros por página |
| `mrv` | `5` | Most Recent Values — devuelve los últimos 5 años con dato disponible |
| `page` | `1, 2, ...` | Paginación automática hasta agotar resultados |

### Comportamiento técnico

- **Sin autenticación:** API completamente pública, sin API key.
- **Lag de publicación:** El Banco Mundial publica los datos con 1–2 años de retraso según el indicador. El año más reciente disponible en la respuesta puede no ser el año calendario actual.
- **Reintentos:** 3 reintentos con backoff exponencial (2 s × 2^intento). (`fetchIndicator.ts:24-25`)
- **Timeout:** 30 segundos por request. (`fetchIndicator.ts:22`)
- **Formato de respuesta:** Array de dos elementos `[metadata, entries[]]`.
- **Validación de registros:** Se descartan entradas con `value = null`, código de país no alfanumérico (regex `/^[A-Z]{3}$/`), o año con formato inválido (regex `/^\d{4}$/`).
- **Inserción en BD:** `INSERT OR REPLACE` en lotes de 100 registros. Campo `source` siempre vale `'world_bank'`.

---

## IMF DataMapper API

**URL base:** `https://www.imf.org/external/datamapper/api/v1/`

**Patrón de endpoint:**
```
GET https://www.imf.org/external/datamapper/api/v1/{IMF_CODE}
    ?periods={año1},{año2},...
```

**Endpoint de nombres de países:**
```
GET https://www.imf.org/external/datamapper/api/v1/countries
```

### Parámetros clave

| Parámetro | Valor | Significado |
|---|---|---|
| `periods` | `2020,2021,2022,2023,2024` | Años a solicitar (generados dinámicamente desde el año actual) |

### Comportamiento técnico

- **Sin autenticación:** API completamente pública, sin API key.
- **Sin paginación:** Un solo request devuelve todos los países (~190 miembros del FMI).
- **Cobertura:** ~190 países (miembros del FMI). Mayor cobertura que World Bank en indicadores fiscales.
- **Lag de publicación:** Los datos del FMI provienen del World Economic Outlook (WEO), publicado dos veces al año (abril y octubre). El lag típico es 1 año.
- **Reintentos:** 3 reintentos con backoff exponencial (2 s × 2^intento). (`fetchIMFIndicator.ts`)
- **Timeout:** 30 segundos por request.
- **Formato de respuesta:**
  ```json
  { "values": { "BCA_NGDPD": { "ARG": { "2022": -0.9, "2023": -1.2 }, ... } } }
  ```
  Los códigos de país son ISO alpha-3. Los valores son `number | null`.
- **Nombres de países:** Se obtienen del endpoint `/countries` en el mismo cron call (request paralelo).
- **Validación de registros:** Se descartan entradas con `value = null`, código de país que no cumple `/^[A-Z]{3}$/`, o año que no cumple `/^\d{4}$/`.
- **Inserción en BD:** `INSERT OR REPLACE` en lotes de 100 registros. Campo `source` siempre vale `'imf'`.
- **Fetcher:** `src/lib/server/fetchIMFIndicator.ts`

---

## OECD Statistics API (SDMX-JSON)

**URL base:** `https://sdmx.oecd.org/public/rest/`

**Patrón de endpoint:**
```
GET https://sdmx.oecd.org/public/rest/data/{SDMX_PATH}/all
    ?format=jsondata
    &lastNObservations=5
```

Donde `{SDMX_PATH}` sigue la estructura SDMX: `{agencia},{dataflow}/{key_filter}`.

Ejemplo para FDI:
```
https://sdmx.oecd.org/public/rest/data/OECD.DAF.INV,DSD_FDI@DF_FDI_AGG/A..W2.IN.USD.T/all
    ?format=jsondata
    &lastNObservations=5
```

### Parámetros del key filter (FDI dataset)

| Dimensión | Código usado | Significado |
|---|---|---|
| FREQ | `A` | Anual |
| REF_AREA | `.` | Todos los países OCDE |
| COUNTERPART_AREA | `W2` | Mundo (total de todos los socios) |
| FLOW_TYPE | `IN` | Entradas (inflows) |
| CURRENCY | `USD` | Dólares estadounidenses |
| ACCOUNTING_ENTRY | `T` | Total |

### Comportamiento técnico

- **Sin autenticación:** API pública, sin API key.
- **Sin paginación:** `lastNObservations=5` limita a las 5 observaciones más recientes por serie.
- **Cobertura:** ~38 países OCDE + algunos países socios. Significativamente menor que WB o IMF.
- **Lag de publicación:** Variable por indicador. FDI: ~1–2 años.
- **Reintentos:** 3 reintentos con backoff exponencial.
- **Timeout:** 60 segundos por request (respuestas más grandes que WB/IMF).
- **Formato de respuesta:** SDMX-JSON estándar. El parser extrae:
  - Posición de `REF_AREA` dentro de `structure.dimensions.series` para obtener el código de país ISO3.
  - `TIME_PERIOD` de `structure.dimensions.observation` para obtener el año.
  - Valor: `dataSets[0].series[key].observations[t][0]`.
- **Validación de registros:** Mismas reglas que WB/IMF (null, ISO3, YYYY).
- **Inserción en BD:** `INSERT OR REPLACE` en lotes de 100 registros. Campo `source` siempre vale `'oecd'`.
- **Fetcher:** `src/lib/server/fetchOECDIndicator.ts`

> **Nota:** El campo `code` del `IndicatorConfig` para indicadores OECD contiene el `{SDMX_PATH}` completo (dataflow + key filter). El fetcher lo inserta directamente en la URL.

---

## Indicadores actuales

Definidos en `src/lib/indicators/` e importados en `src/lib/indicators/index.ts`.

| ID interno | Nombre visible | Código API | Unidad | Alto valor = | API | Archivo |
|---|---|---|---|---|---|---|
| `inflation` | Inflación | `FP.CPI.TOTL.ZG` | `%` | Malo | World Bank | `inflation.ts` |
| `gdp` | PIB per cápita | `NY.GDP.PCAP.CD` | `USD` | Bueno | World Bank | `gdp.ts` |
| `unemployment` | Desempleo | `SL.UEM.TOTL.ZS` | `%` | Malo | World Bank | `unemployment.ts` |
| `debt` | Deuda/PIB | `GC.DOD.TOTL.GD.ZS` | `%` | Malo | World Bank | `debt.ts` |
| `exchange` | Tipo de cambio | `PA.NUS.FCRF` | `LCU/USD` | Malo | World Bank | `exchange.ts` |
| `current_account` | Cuenta corriente | `BCA_NGDPD` | `% PIB` | Bueno | IMF | `current-account.ts` |
| `fiscal_balance` | Balance fiscal | `GGXCNL_NGDP` | `% PIB` | Bueno | IMF | `fiscal-balance.ts` |
| `reserves` | Reservas internacionales | `Reserves_M` | `meses` | Bueno | IMF | `reserves.ts` |
| `fdi_inflows` | IED entradas netas | `OECD.DAF.INV,...` | `M USD` | Bueno | OECD | `fdi-inflows.ts` |

### Detalles por indicador

#### `inflation` — Inflación (FP.CPI.TOTL.ZG)
- **Descripción WB:** Variación anual del Índice de Precios al Consumidor (IPC).
- **Cobertura típica:** ~155–170 países.
- **Lag habitual:** 1–2 años. Muchos países reportan con retraso.
- **Notas:** Valores extremos posibles en economías con hiperinflación.

#### `gdp` — PIB per cápita (NY.GDP.PCAP.CD)
- **Descripción WB:** PIB dividido por la población a mitad de año, en dólares corrientes.
- **Cobertura típica:** ~185–195 países. Es el indicador con mayor cobertura.
- **Lag habitual:** 1–2 años.
- **Notas:** Expresado en USD corrientes (no ajustado por PPP).

#### `unemployment` — Desempleo (SL.UEM.TOTL.ZS)
- **Descripción WB:** Porcentaje de la fuerza laboral sin empleo (modelo OIT).
- **Cobertura típica:** ~140–160 países. Menor cobertura por dificultad de medición.
- **Lag habitual:** 1–3 años. Algunos países actualizan con retraso importante.
- **Notas:** Estimaciones modeladas para países sin encuestas laborales recientes.

#### `debt` — Deuda/PIB (GC.DOD.TOTL.GD.ZS)
- **Descripción WB:** Deuda bruta del gobierno central como porcentaje del PIB.
- **Cobertura típica:** ~100–130 países. Cobertura más baja por disponibilidad de datos fiscales.
- **Lag habitual:** 2–3 años.
- **Notas:** Solo deuda del gobierno central, no incluye empresas estatales ni deuda subnacional.

#### `exchange` — Tipo de cambio (PA.NUS.FCRF)
- **Descripción WB:** Unidades de moneda local por 1 USD, tipo de cambio oficial promedio anual.
- **Cobertura típica:** ~155–175 países.
- **Lag habitual:** 1–2 años.
- **Notas:** No aplica para países que usan el dólar (USD) como moneda oficial; esos registros pueden aparecer como `null` o `1`.

#### `current_account` — Cuenta corriente (BCA_NGDPD)
- **Descripción IMF:** Saldo de la cuenta corriente de la balanza de pagos, como porcentaje del PIB.
- **Cobertura típica:** ~190 países (miembros del FMI).
- **Lag habitual:** 1 año. Publicado con el WEO (abril/octubre).
- **Notas:** Positivo = superávit (el país exporta más de lo que importa + transferencias). Negativo = déficit.

#### `fiscal_balance` — Balance fiscal del gobierno (GGXCNL_NGDP)
- **Descripción IMF:** Balance fiscal neto del gobierno general como porcentaje del PIB.
- **Cobertura típica:** ~190 países.
- **Lag habitual:** 1–2 años.
- **Notas:** Positivo = superávit fiscal. Negativo = déficit. Incluye gobierno central, regional y local.

#### `reserves` — Reservas internacionales en meses de importación (Reserves_M)
- **Descripción IMF:** Reservas internacionales totales expresadas en meses de importaciones de bienes y servicios.
- **Cobertura típica:** ~180 países.
- **Lag habitual:** 1 año.
- **Notas:** Un valor ≥ 3 meses se considera adecuado (regla de thumb del FMI). Valores muy altos (~12+) en países exportadores de commodities con fondos soberanos.

#### `fdi_inflows` — IED entradas netas (OECD FDI Aggregates)
- **Descripción OECD:** Inversión Extranjera Directa (IED) entradas netas provenientes del mundo, en millones de USD.
- **Cobertura típica:** ~38 países OCDE + algunos socios. **Mapa mundial quedará vacío para no-miembros.**
- **Lag habitual:** 1–2 años.
- **Notas:** Valores absolutos en M USD, no como % del PIB. Útil para comparar volumen de atracción de inversión. El valor puede ser negativo (desinversión neta).

---

## Cobertura geográfica

- **Lookup de países:** `src/lib/countryLookup.ts` — ~195 entradas mapeando ISO 3166-1 numérico → ISO 3166-1 alpha-3.
- **Código usado en BD:** ISO alpha-3 (3 letras mayúsculas, ej. `ARG`, `BRA`, `USA`).
- **Cobertura real por indicador:** Depende de lo que devuelve cada API. La cobertura varía (ver detalles arriba).
- Para consultar la cobertura real actual en producción:
  ```sql
  SELECT indicator, source, COUNT(DISTINCT country_code) AS paises, MAX(year) AS ultimo_anio
  FROM macro_data
  GROUP BY indicator, source
  ORDER BY indicator;
  ```

---

## Parámetros de consulta y límites

| Contexto | Parámetro | Valor | Archivo |
|---|---|---|---|
| Fetch WB API | `mrv` | 5 años más recientes | `fetchIndicator.ts:42` |
| Fetch WB API | `per_page` | 500 registros/página | `fetchIndicator.ts:27` |
| Fetch IMF API | `periods` | 5 años desde año actual | `fetchIMFIndicator.ts` |
| Fetch OECD API | `lastNObservations` | 5 observaciones por serie | `fetchOECDIndicator.ts` |
| Inserción BD | Batch D1 | 100 statements/lote | Todos los fetchers |
| Query serie temporal | `LIMIT` | 20 años por país-indicador | `+server.ts:52` |
| Query choropleth | Año | `MAX(year)` por país | `+server.ts:37-41` |

---

## Ciclo de actualización

Los datos se actualizan mediante el endpoint cron:

```
POST /api/cron/fetch-data
     Authorization: Bearer {CRON_SECRET}
```

- Dispara los 9 indicadores **en paralelo** (5 WB + 3 IMF + 1 OECD).
- Cada ejecución registra resultado en tabla `fetch_log` (campos: `indicator`, `status`, `records`, `filtered_out`, `error_message`, `fetched_at`).
- Para ver el historial de fetches:
  ```sql
  SELECT * FROM fetch_log ORDER BY fetched_at DESC LIMIT 50;
  ```

---

## Routing de fetchers en el cron

El campo `api` en `IndicatorJob` determina qué fetcher se usa:

| `api` | Fetcher | Archivo |
|---|---|---|
| `'world_bank'` (default) | `fetchIndicator` | `src/lib/server/fetchIndicator.ts` |
| `'imf'` | `fetchIMFIndicator` | `src/lib/server/fetchIMFIndicator.ts` |
| `'oecd'` | `fetchOECDIndicator` | `src/lib/server/fetchOECDIndicator.ts` |

La función `runOne(job, db)` en los archivos de cron despacha al fetcher correcto.

---

## Futuras APIs

Cuando se integre una nueva fuente de datos, agregar una sección siguiendo esta estructura:

```markdown
## [Nombre de la API]

**URL base:** ...
**Autenticación:** [API key / OAuth / pública]
**Documentación oficial:** ...

### Parámetros clave
| Parámetro | Valor | Significado |
|---|---|---|
| ... | ... | ... |

### Indicadores que provee
| ID interno | Nombre | Código en la API | Unidad | Alto valor = |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

### Notas
- Cobertura de países: ...
- Lag de publicación: ...
- Frecuencia de actualización: ...
```

**Candidatos posibles para evaluación futura:**
- **FRED (Federal Reserve):** `https://fred.stlouisfed.org/docs/api/fred/` — requiere API key gratuita; enfocado en datos de EE.UU. y agregados globales.
- **Banco Central Europeo (ECB):** `https://data.ecb.europa.eu/` — datos de la eurozona, formato SDMX.
- **OIT (ILO):** `https://ilostat.ilo.org/resources/ilostat-api/` — indicadores laborales globales, formato SDMX.
- **FAO:** `https://www.fao.org/faostat/en/#data` — datos agrícolas y alimentarios por país.
