# API Reference

Base URL: `https://<dominio>` (o `http://localhost:5173` en dev)

## Autenticación

La mayoría de endpoints requieren una cookie de sesión válida (`session_id`).  
El endpoint cron usa autenticación por token en query param.  
En dev local sin KV binding, la autenticación se omite automáticamente.

---

## GET /api/macro

Consulta datos macroeconómicos desde la base D1.

### Modo choropleth — todos los países, último año disponible

```
GET /api/macro?indicator=<id>
```

| Param | Tipo | Requerido | Valores válidos |
|---|---|---|---|
| `indicator` | string | no (default: `inflation`) | `inflation`, `gdp`, `unemployment`, `debt`, `exchange` |

**Respuesta 200:**
```json
{
  "indicator": "gdp",
  "data": [
    { "country_code": "ARG", "country_name": "Argentina", "value": 10732.47, "year": 2023 },
    { "country_code": "BRA", "country_name": "Brazil", "value": 8917.22, "year": 2023 }
  ]
}
```

### Modo serie de tiempo — un país, hasta 20 años

```
GET /api/macro?country=<iso3>&indicator=<id>
```

| Param | Tipo | Requerido | Validación |
|---|---|---|---|
| `country` | string | sí | 3 letras mayúsculas (ISO 3166-1 alpha-3) |
| `indicator` | string | no | mismo que arriba |

**Respuesta 200:**
```json
{
  "country": "MEX",
  "indicator": "inflation",
  "data": [
    { "year": 2004, "value": 4.69, "country_name": "Mexico" },
    { "year": 2005, "value": 3.99, "country_name": "Mexico" }
  ]
}
```

**Errores:**

| Código | Body | Causa |
|---|---|---|
| 400 | `{ "error": "Indicador inválido" }` | `indicator` no está en la lista válida |
| 400 | `{ "error": "Código de país inválido" }` | `country` no cumple `/^[A-Z]{3}$/` |
| 401 | `{ "error": "No autorizado" }` | Sin sesión válida (solo en producción) |

---

## GET /api/cron/fetch-data

Dispara la extracción de datos desde World Bank API hacia D1.

```
GET /api/cron/fetch-data?token=<CRON_SECRET>
```

| Param | Tipo | Requerido |
|---|---|---|
| `token` | string | sí |

**Respuesta 200:**
```json
{ "ok": true }
```

**Errores:**

| Código | Body | Causa |
|---|---|---|
| 403 | `Forbidden` | Token ausente o incorrecto |
| 503 | `{ "error": "DB no disponible" }` | Binding D1 no configurado |

Procesa los 5 indicadores en paralelo (`Promise.allSettled`). Los errores por indicador se registran en `fetch_log` sin interrumpir los demás.

---

## GET /api/auth/google

Inicia el flujo OAuth 2.0 con Google.

```
GET /api/auth/google
```

Redirige (`302`) a `accounts.google.com` con los parámetros OAuth. Establece cookie `oauth_state` (HttpOnly, Max-Age: 600s).

---

## GET /api/auth/google/callback

Callback de Google tras autorización del usuario.

```
GET /api/auth/google/callback?code=<auth_code>&state=<state>
```

Intercambia el `code` por tokens, obtiene perfil del usuario, crea sesión en KV y redirige al dashboard.

---

## GET /api/auth/logout

Elimina la sesión activa.

```
GET /api/auth/logout
```

Borra la cookie `session_id` y la entrada en KV. Redirige a `/login`.
