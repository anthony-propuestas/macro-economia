# Deployment

Deploy a Cloudflare Pages con Workers, D1 y KV.

## Pre-requisitos

- Cuenta de Cloudflare
- `wrangler` CLI instalado: `npm install -g wrangler`
- Autenticado: `wrangler login`
- App de Google OAuth configurada en [Google Cloud Console](https://console.cloud.google.com/)

## 1. Crear la base de datos D1

```bash
wrangler d1 create macro-db
```

Copiar el `database_id` generado y actualizarlo en `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "macro-db"
database_id = "<id-generado>"
```

Aplicar el schema:

```bash
wrangler d1 execute macro-db --file=schema.sql --remote
```

## 2. Crear el namespace KV

```bash
wrangler kv namespace create SESSIONS
wrangler kv namespace create SESSIONS --preview
```

Copiar los IDs generados y actualizar `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "<id-produccion>"
preview_id = "<id-preview>"
```

## 3. Configurar secretos

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put CRON_SECRET
```

Cada comando pedirá el valor por stdin (no queda en el historial del shell).

## 4. Configurar Google OAuth

En [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials:

- Tipo: **Web application**
- Redirect URI autorizada: `https://<tu-dominio>/api/auth/google/callback`

## 5. Build y deploy

```bash
npm run build
wrangler pages deploy .svelte-kit/cloudflare
```

El primer deploy asigna un subdominio `*.pages.dev`. Los deploys subsiguientes actualizan el mismo proyecto.

## 6. Configurar el cron job

En el dashboard de Cloudflare → Workers & Pages → tu proyecto → Settings → Cron Triggers:

- Agregar trigger: `0 6 * * *` (todos los días a las 6:00 UTC)
- El trigger llamará internamente a `/api/cron/fetch-data?token=<CRON_SECRET>`

Alternativamente, se puede llamar manualmente:

```bash
curl "https://<dominio>/api/cron/fetch-data?token=<CRON_SECRET>"
```

## Variables de entorno locales

Crear `.dev.vars` (no commitear):

```env
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
CRON_SECRET=<token-aleatorio>
```

Para desarrollo local con D1 y KV simulados:

```bash
wrangler pages dev .svelte-kit/cloudflare --d1 DB=<database_id>
```

O simplemente `npm run dev` — en ese modo el auth se omite automáticamente.
