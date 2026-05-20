# Security

## Autenticación

El acceso al dashboard requiere Google OAuth 2.0. El flujo es:

1. Usuario visita cualquier ruta protegida → redirigido a `/login`
2. Login inicia OAuth → `GET /api/auth/google` → redirige a Google
3. Google devuelve `code` → `GET /api/auth/google/callback` crea sesión en KV
4. Session ID se guarda como cookie `HttpOnly; SameSite=Lax`

Las rutas `/login` y `/api/*` están excluidas del middleware de auth.

## Sesiones

- Almacenadas en **Cloudflare KV** (binding `SESSIONS`)
- Clave: UUID aleatorio (`session_id`)
- Valor: JSON `{ user: { email, name, picture } }`
- Cookie: `session_id=<uuid>; HttpOnly; SameSite=Lax; Secure` (Secure omitido en localhost)
- Validación en `src/routes/+layout.server.ts` y `src/routes/api/macro/+server.ts`

## Variables de entorno sensibles

| Variable | Dónde se usa | Descripción |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth initiate | ID de la app en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth callback | Secret de la app en Google Cloud Console |
| `CRON_SECRET` | `/api/cron/fetch-data` | Token para autorizar el cron job |

En desarrollo local se definen en `.dev.vars` (nunca commitear este archivo).
En producción se configuran con `wrangler secret put <VAR>`.

## Protección del endpoint cron

`GET /api/cron/fetch-data?token=<CRON_SECRET>`

- Si `CRON_SECRET` no está configurado o el `token` no coincide → `403 Forbidden`
- Este endpoint no requiere sesión de usuario, solo el token
- Configurar en Cloudflare dashboard como Cron Trigger programado

## Modo desarrollo sin auth

Cuando `platform?.env?.SESSIONS` no está disponible (dev local sin wrangler), el middleware retorna automáticamente `{ user: { email: 'dev@local', name: 'Dev User' } }` sin verificar sesión. Esto **nunca ocurre en producción** donde KV siempre está presente.

## CSRF / State OAuth

El parámetro `state` en el flujo OAuth es un UUID aleatorio guardado como cookie `oauth_state` (Max-Age: 600s). El callback debe validar que coincide antes de intercambiar el `code`.

## Recomendaciones

- Rotar `CRON_SECRET` periódicamente con `wrangler secret put CRON_SECRET`
- La URL de callback en Google Cloud Console debe ser exactamente `https://<dominio>/api/auth/google/callback`
- No exponer el binding `DB` directamente al cliente — todas las queries pasan por rutas server-side
