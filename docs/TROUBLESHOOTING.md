# Troubleshooting

## El fetch cron falla o no inserta datos

**Diagnóstico:**

```bash
wrangler d1 execute macro-db --command="SELECT * FROM fetch_log ORDER BY fetched_at DESC LIMIT 10" --remote
```

Buscar filas con `status = 'error'` y revisar `error_message`.

**Causas comunes:**

| Error | Solución |
|---|---|
| `HTTP 429` o timeout | World Bank API con rate limit — el pipeline reintenta 3 veces con backoff exponencial (2s, 4s, 8s). Si persiste, esperar y relanzar manualmente. |
| `Forbidden` al llamar el endpoint | `CRON_SECRET` no configurado o token incorrecto. Verificar con `wrangler secret list`. |
| `DB no disponible` (503) | Binding `DB` no configurado en `wrangler.toml` o deploy sin el binding. |
| `Unexpected API response shape` | World Bank cambió el formato de respuesta. Revisar la URL y el payload en `src/lib/server/fetchIndicator.ts`. |

## El mapa aparece vacío o sin colores

**Causa más común:** No hay datos para el año actual en D1.

World Bank publica datos con retraso de 1-2 años. La query del choropleth toma el `MAX(year)` por país, por lo que si no hay datos recientes, el mapa puede mostrar pocos países.

**Verificar cobertura:**

```bash
wrangler d1 execute macro-db --command="SELECT indicator, COUNT(DISTINCT country_code) as paises, MAX(year) as ultimo FROM macro_data GROUP BY indicator" --remote
```

Si hay 0 filas, el fetch nunca se ejecutó — llamar al endpoint cron manualmente:

```bash
curl "https://<dominio>/api/cron/fetch-data?token=<CRON_SECRET>"
```

## El login redirige en loop o da error OAuth

1. Verificar que `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén configurados:
   ```bash
   wrangler secret list
   ```
2. Verificar que la Redirect URI en Google Cloud Console sea exactamente:
   `https://<dominio>/api/auth/google/callback`
3. Si la cookie `oauth_state` expiró (Max-Age: 600s), reintentar el login.

## La sesión expira prematuramente

Las sesiones en KV no tienen TTL explícito definido en el código actual. Si el KV namespace fue purgado o la entrada eliminada, la cookie queda huérfana.

**Solución:** El usuario debe borrar la cookie `session_id` desde el navegador (DevTools → Application → Cookies) y hacer login nuevamente.

## Un indicador no aparece en el sidebar o el mapa

Verificar que el indicador esté exportado correctamente:

1. El archivo `src/lib/indicators/<nombre>.ts` debe exportar un objeto con la forma `IndicatorConfig`
2. Debe estar incluido en el array `indicators` de `src/lib/indicators/index.ts`
3. Si recién se agregó, hacer `npm run build` y redesplegar

Verificar que los tests pasen:

```bash
npm run test
```

## Error `TypeError: Cannot read properties of undefined (reading 'env')`

Ocurre cuando se accede a `platform.env` sin el operador opcional `?.`.  
En dev sin wrangler, `platform` es `undefined`. Siempre usar `platform?.env?.DB`.

## D1 out of sync (columna faltante o tabla inexistente)

Si el schema cambió y la base de datos no fue migrada:

```bash
wrangler d1 execute macro-db --file=schema.sql --remote
```

El schema usa `CREATE TABLE IF NOT EXISTS` — es seguro re-ejecutar.  
Para agregar columnas a tablas existentes se necesita `ALTER TABLE` explícito.
