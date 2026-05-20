# Indicadores y Fuentes de Datos

Referencia completa de qué indicadores existen, de qué API provienen, y los parámetros técnicos de cada fuente. Actualizar este archivo cada vez que se agregue un nuevo indicador o una nueva API.

---

## Resumen de fuentes activas

| API | Indicadores que provee | Requiere clave | Estado |
|---|---|---|---|
| World Bank Open Data | inflation, gdp, unemployment, debt, exchange, current_account, fiscal_balance, reserves, fdi_inflows | No | Activa |
| IMF DataMapper | — | No | No integrada |
| OECD Statistics (SDMX) | — | No | No integrada |

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
| `current_account` | Cuenta corriente | `BN.CAB.XOKA.GD.ZS` | `% PIB` | Bueno | World Bank | `current-account.ts` |
| `fiscal_balance` | Balance fiscal | `GC.NLD.TOTL.GD.ZS` | `% PIB` | Bueno | World Bank | `fiscal-balance.ts` |
| `reserves` | Reservas internacionales | `FI.RES.TOTL.MO` | `meses` | Bueno | World Bank | `reserves.ts` |
| `fdi_inflows` | IED entradas netas | `BX.KLT.DINV.CD.WD` | `USD` | Bueno | World Bank | `fdi-inflows.ts` |

### Detalles por indicador

#### `inflation` — Inflación (FP.CPI.TOTL.ZG)
- **Qué mide:** El aumento generalizado del nivel de precios de bienes y servicios en un año. Un valor de 5 significa que lo que costaba 100 al inicio del año cuesta 105 al final.
- **Fórmula:** `(IPC_año_actual / IPC_año_anterior − 1) × 100`
- **API provee calculado:** Sí. World Bank entrega directamente la variación % anual; no se requiere procesar el IPC bruto.
- **Cobertura típica:** ~155–170 países.
- **Lag habitual:** 1–2 años. Muchos países reportan con retraso.
- **Notas:** Valores extremos posibles en economías con hiperinflación.

#### `gdp` — PIB per cápita (NY.GDP.PCAP.CD)
- **Qué mide:** El valor de todos los bienes y servicios producidos en un país dividido entre su población. Proxy del nivel de vida material promedio.
- **Fórmula:** `PIB_total_USD / Población_midyear`
- **API provee calculado:** Sí. World Bank entrega el cociente final en USD corrientes.
- **Cobertura típica:** ~185–195 países. Es el indicador con mayor cobertura.
- **Lag habitual:** 1–2 años.
- **Notas:** Expresado en USD corrientes (no ajustado por PPP).

#### `unemployment` — Desempleo (SL.UEM.TOTL.ZS)
- **Qué mide:** Porcentaje de la fuerza laboral activa que busca trabajo pero no lo tiene. No incluye personas que dejaron de buscar (desempleo oculto).
- **Fórmula:** `Desempleados / (Empleados + Desempleados) × 100`
- **API provee calculado:** Sí. World Bank entrega el % final basado en estimaciones modeladas de la OIT.
- **Cobertura típica:** ~140–160 países. Menor cobertura por dificultad de medición.
- **Lag habitual:** 1–3 años. Algunos países actualizan con retraso importante.
- **Notas:** Estimaciones modeladas para países sin encuestas laborales recientes.

#### `debt` — Deuda/PIB (GC.DOD.TOTL.GD.ZS)
- **Qué mide:** Cuánto debe el gobierno central en relación con el tamaño de su economía. Un 60 % significa que la deuda equivale a 7 meses del PIB anual.
- **Fórmula:** `Deuda_bruta_gobierno_central_USD / PIB_USD × 100`
- **API provee calculado:** Sí. World Bank entrega directamente el ratio porcentual.
- **Cobertura típica:** ~100–130 países. Cobertura más baja por disponibilidad de datos fiscales.
- **Lag habitual:** 2–3 años.
- **Notas:** Solo deuda del gobierno central, no incluye empresas estatales ni deuda subnacional.

#### `exchange` — Tipo de cambio (PA.NUS.FCRF)
- **Qué mide:** Cuántas unidades de moneda local se necesitan para comprar 1 dólar estadounidense, promediado durante el año. Refleja el precio relativo de las monedas.
- **Fórmula:** Promedio ponderado del tipo de cambio oficial durante el año calendario.
- **API provee calculado:** Sí. World Bank entrega el promedio anual directamente.
- **Cobertura típica:** ~155–175 países.
- **Lag habitual:** 1–2 años.
- **Notas:** No aplica para países que usan el dólar (USD) como moneda oficial; esos registros pueden aparecer como `null` o `1`.

#### `current_account` — Cuenta corriente (BN.CAB.XOKA.GD.ZS)
- **Qué mide:** Si un país vende al exterior más de lo que compra (superávit) o lo contrario (déficit), incluyendo bienes, servicios, rentas y transferencias, como porcentaje del PIB.
- **Fórmula:** `(Exportaciones − Importaciones + Renta_neta + Transferencias_netas) / PIB × 100`
- **API provee calculado:** Sí. World Bank entrega el ratio % del PIB directamente.
- **Fuente:** World Bank (`BN.CAB.XOKA.GD.ZS`), no IMF.
- **Cobertura típica:** ~140–160 países.
- **Lag habitual:** 1–2 años.
- **Notas:** Positivo = superávit (el país exporta más de lo que importa + transferencias). Negativo = déficit.

#### `fiscal_balance` — Balance fiscal del gobierno (GC.NLD.TOTL.GD.ZS)
- **Qué mide:** Si el gobierno gasta más de lo que ingresa (déficit) o menos (superávit), como porcentaje del PIB. Es el "saldo" de las cuentas públicas en un año.
- **Fórmula:** `(Ingresos_gobierno − Gastos_gobierno) / PIB × 100`
- **API provee calculado:** Sí. World Bank entrega el ratio % del PIB directamente.
- **Fuente:** World Bank (`GC.NLD.TOTL.GD.ZS`), no IMF.
- **Cobertura típica:** ~100–130 países.
- **Lag habitual:** 2–3 años.
- **Notas:** Positivo = superávit fiscal. Negativo = déficit. Cubre solo gobierno central.

#### `reserves` — Reservas internacionales en meses de importación (FI.RES.TOTL.MO)
- **Qué mide:** Cuántos meses podría el país pagar sus importaciones usando solo sus reservas internacionales (divisas + oro + derechos especiales de giro). Indica capacidad de respuesta ante crisis externas.
- **Fórmula:** `Reservas_internacionales_USD / (Importaciones_anuales_USD / 12)`
- **API provee calculado:** Sí. World Bank entrega el valor en meses directamente; no hay que dividir reservas brutas.
- **Fuente:** World Bank (`FI.RES.TOTL.MO`), no IMF.
- **Cobertura típica:** ~150–170 países.
- **Lag habitual:** 1–2 años.
- **Notas:** Un valor ≥ 3 meses se considera adecuado (regla de thumb del FMI). Valores muy altos (~12+) en países exportadores de commodities con fondos soberanos.

#### `fdi_inflows` — IED entradas netas (BX.KLT.DINV.CD.WD)
- **Qué mide:** Cuánto capital extranjero entra al país como inversión de largo plazo (fábricas, empresas, participaciones ≥10 %), neto de las salidas. En USD corrientes.
- **Fórmula:** `IED_entradas_brutas_USD − IED_salidas_brutas_USD`
- **API provee calculado:** Sí. World Bank entrega el neto en USD directamente.
- **Fuente:** World Bank (`BX.KLT.DINV.CD.WD`), no OECD.
- **Cobertura típica:** ~170–185 países.
- **Lag habitual:** 1–2 años.
- **Notas:** Valor en USD corrientes (no % PIB). Puede ser negativo (desinversión neta: los inversores extranjeros retiran más capital del que invierten).

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

Actualmente `functions/api/cron/fetch-data.ts` usa `fetchIndicator` (World Bank) para los 9 indicadores. Los fetchers de IMF y OECD existen en el código pero no están conectados al cron.

| Fetcher | Estado | Archivo |
|---|---|---|
| `fetchIndicator` (World Bank) | Activo — usado por los 9 indicadores | `src/lib/server/fetchIndicator.ts` |
| `fetchIMFIndicator` | Implementado, no conectado al cron | `src/lib/server/fetchIMFIndicator.ts` |
| `fetchOECDIndicator` | Implementado, no conectado al cron | `src/lib/server/fetchOECDIndicator.ts` |

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
