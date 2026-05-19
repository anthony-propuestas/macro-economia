# MacroObserver — Plan de Desarrollo

> Web app de observación macroeconómica con mapa mundial interactivo,
> autenticación Google y backend 100% en **Cloudflare Pages + Workers**.

---

## 🎯 Objetivo

Crear una web donde el usuario pueda:
- Ver un **mapa mundial interactivo** con nombres de países
- Hacer hover sobre un país para ver datos al instante
- Seleccionar **indicadores macroeconómicos** (empezando con Inflación)
- Ver los datos históricos en una gráfica
- Todo protegido por **login con Google**

---

## 🏗️ Stack Tecnológico

| Capa | Herramienta | Justificación |
|---|---|---|
| **Hosting** | Cloudflare Pages | Gratis, CDN global, deploy desde Git |
| **Backend/API** | Cloudflare Workers | Serverless en el edge, plan gratuito generoso |
| **Base de datos** | Cloudflare D1 | SQLite en el edge, 5GB gratis |
| **Cache/Sesiones** | Cloudflare KV | Almacén clave-valor para tokens de sesión |
| **Cron Jobs** | Cloudflare Cron Triggers | Actualización automática de datos |
| **Frontend** | SvelteKit o React | Deploy directo a Cloudflare Pages |
| **Mapa** | D3.js + TopoJSON | Libre, sin costo, 200+ países |
| **Gráficas** | Chart.js o Recharts | Gratuito, fácil integración |
| **Autenticación** | Google OAuth 2.0 | Gratis, sin librerías de pago |
| **Fuente de datos** | World Bank API + IMF | APIs públicas y gratuitas sin key |

---

## ☁️ Cloudflare Pages — Arquitectura Central

**Cloudflare Pages** es el núcleo del despliegue. Todo el proyecto vive en Cloudflare:

```
Cloudflare Pages
├── Frontend (SvelteKit/React build estático)
├── Pages Functions (Workers integrados — rutas /api/*)
│   ├── /api/auth/google       → callback OAuth
│   ├── /api/auth/session      → validar sesión
│   ├── /api/macro             → consultar datos
│   └── /api/cron/fetch-data   → actualizar desde APIs externas
├── D1 Database (macro_db)     → datos históricos de inflación
└── KV Namespace (sessions)    → tokens de sesión activos
```

**Ventajas de Cloudflare Pages sobre otras opciones:**
- Deploy automático desde GitHub en cada push
- Workers integrados como "Pages Functions" (sin proyecto separado)
- D1 y KV se bindan directamente al proyecto
- SSL gratuito y dominio `.pages.dev` incluido
- Plan gratuito cubre 500 builds/mes y 100K requests/día

---

## 📋 Fases de Desarrollo

### Fase 1 — Configuración inicial (1-2 días)

#### 1.1 Cloudflare
1. Crear cuenta en [dash.cloudflare.com](https://dash.cloudflare.com)
2. Nuevo proyecto → **Pages** → conectar repositorio GitHub
3. Crear base de datos D1:
   ```bash
   npx wrangler d1 create macro-db
   ```
4. Crear namespace KV:
   ```bash
   npx wrangler kv:namespace create sessions
   ```
5. Anotar los IDs generados y agregarlos a `wrangler.toml`

#### 1.2 Google Cloud Console
1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear proyecto → habilitar **Google Identity API**
3. Credenciales → OAuth 2.0 Client ID
4. Authorized redirect URI:
   ```
   https://tu-proyecto.pages.dev/api/auth/google/callback
   ```
5. Guardar `CLIENT_ID` y `CLIENT_SECRET` como secrets en Cloudflare Pages

#### 1.3 VS Code + herramientas
```bash
# Node.js 20+
node -v

# Wrangler CLI (herramienta de Cloudflare)
npm install -g wrangler
wrangler login

# Crear proyecto base
npm create cloudflare@latest macro-observer -- --framework=svelte
cd macro-observer

# Extensiones recomendadas VS Code
# - Claude Code (Anthropic)
# - Svelte for VS Code
# - Cloudflare Workers
# - ESLint + Prettier
```

---

### Fase 2 — Autenticación Google OAuth (1 día)

#### Flujo de autenticación
```
Usuario → clic "Login con Google"
  → redirige a Google OAuth
  → Google regresa token a /api/auth/google/callback
  → Worker valida token → crea sesión en KV
  → redirige al frontend con cookie de sesión
```

#### Archivo: `functions/api/auth/google/callback.ts`
```typescript
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // Intercambiar code por access_token con Google
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();

  // Guardar sesión en KV (expira en 7 días)
  const sessionId = crypto.randomUUID();
  await env.SESSIONS.put(sessionId, JSON.stringify({
    access_token: tokens.access_token,
    created_at: Date.now(),
  }), { expirationTtl: 604800 });

  // Cookie de sesión + redirect al dashboard
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/`,
    },
  });
}
```

---

### Fase 3 — Mapa Mundial Interactivo (2 días)

#### Librerías usadas
- **D3.js** — proyección y render del mapa SVG
- **TopoJSON** — datos de fronteras (gratis, sin API key)
  - URL: `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`

#### Componente: `MapaMundo.svelte`
```svelte
<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { feature } from 'topojson-client';

  let tooltip = { visible: false, x: 0, y: 0, nombre: '', valor: '' };

  onMount(async () => {
    const world = await fetch(
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
    ).then(r => r.json());

    const countries = feature(world, world.objects.countries);
    const svg = d3.select('#mapa');
    const projection = d3.geoNaturalEarth1().scale(150).translate([480, 300]);
    const path = d3.geoPath().projection(projection);

    svg.selectAll('path')
      .data(countries.features)
      .enter().append('path')
      .attr('d', path)
      .attr('class', 'pais')
      .on('mouseover', (event, d) => {
        // Mostrar tooltip con dato del país
        tooltip = {
          visible: true,
          x: event.pageX,
          y: event.pageY,
          nombre: d.properties?.name ?? 'País',
          valor: '...' // se llena con datos del indicador activo
        };
      })
      .on('mouseout', () => {
        tooltip = { ...tooltip, visible: false };
      })
      .on('click', (event, d) => {
        // Disparar consulta de datos históricos
        cargarDatos(d.id); // id numérico ISO 3166
      });
  });
</script>

<svg id="mapa" width="960" height="600"></svg>

{#if tooltip.visible}
  <div class="tooltip" style="left:{tooltip.x}px; top:{tooltip.y}px">
    <strong>{tooltip.nombre}</strong>
    <span>Inflación: {tooltip.valor}%</span>
  </div>
{/if}
```

---

### Fase 4 — Base de Datos y Pipeline de Datos (2 días)

#### Schema D1 (`macro-db`)
```sql
-- Tabla principal de datos macroeconómicos
CREATE TABLE IF NOT EXISTS macro_data (
  country_code  TEXT    NOT NULL,  -- ISO2: "MX", "US", "BR"
  country_name  TEXT    NOT NULL,
  indicator     TEXT    NOT NULL,  -- "inflation", "gdp", etc.
  year          INTEGER NOT NULL,
  value         REAL,
  source        TEXT,              -- "world_bank", "imf"
  updated_at    TEXT    NOT NULL,
  PRIMARY KEY (country_code, indicator, year)
);

-- Índice para consultas rápidas por país
CREATE INDEX idx_country ON macro_data (country_code, indicator);

-- Log de actualizaciones del cron
CREATE TABLE IF NOT EXISTS fetch_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  indicator   TEXT,
  status      TEXT,
  records     INTEGER,
  fetched_at  TEXT
);
```

#### Aplicar schema
```bash
npx wrangler d1 execute macro-db --file=./schema.sql
```

---

### Fase 5 — APIs Gratuitas y Cron Trigger (2 días)

#### APIs disponibles (sin costo)

| API | Endpoint de Inflación | Requiere Key |
|---|---|---|
| [World Bank](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392) | `api.worldbank.org/v2/country/all/indicator/FP.CPI.TOTL.ZG?format=json&per_page=300` | ❌ No |
| [IMF DataMapper](https://www.imf.org/en/Data) | `dataservices.imf.org/JSON/CompactData/IFS/...` | ❌ No |
| [FRED (Fed St. Louis)](https://fred.stlouisfed.org/docs/api/fred/) | `api.stlouisfed.org/fred/series/observations` | ✅ Gratis |

#### Worker Cron: `functions/api/cron/fetch-data.ts`
```typescript
export async function scheduled(event, env, ctx) {
  const INDICATOR = 'FP.CPI.TOTL.ZG'; // Inflación World Bank
  const url = `https://api.worldbank.org/v2/country/all/indicator/${INDICATOR}?format=json&per_page=500&mrv=5`;

  const res = await fetch(url);
  const [meta, data] = await res.json();

  const stmt = env.DB.prepare(`
    INSERT OR REPLACE INTO macro_data
    (country_code, country_name, indicator, year, value, source, updated_at)
    VALUES (?, ?, 'inflation', ?, ?, 'world_bank', ?)
  `);

  const batch = data
    .filter(d => d.value !== null)
    .map(d => stmt.bind(
      d.countryiso3code,
      d.country.value,
      parseInt(d.date),
      d.value,
      new Date().toISOString()
    ));

  await env.DB.batch(batch);

  // Registrar en log
  await env.DB.prepare(
    `INSERT INTO fetch_log (indicator, status, records, fetched_at)
     VALUES ('inflation', 'ok', ?, ?)`
  ).bind(batch.length, new Date().toISOString()).run();
}
```

#### Configurar cron en `wrangler.toml`
```toml
[[triggers]]
crons = ["0 6 * * *"]  # Todos los días a las 6 AM UTC
```

---

### Fase 6 — API endpoint para el Frontend (1 día)

#### `functions/api/macro.ts`
```typescript
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const country = url.searchParams.get('country');
  const indicator = url.searchParams.get('indicator') ?? 'inflation';

  // Verificar sesión
  const cookie = request.headers.get('Cookie') ?? '';
  const sessionId = cookie.match(/session_id=([^;]+)/)?.[1];
  if (!sessionId || !(await env.SESSIONS.get(sessionId))) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Consultar D1
  const rows = await env.DB.prepare(`
    SELECT year, value, country_name
    FROM macro_data
    WHERE country_code = ? AND indicator = ?
    ORDER BY year DESC LIMIT 20
  `).bind(country, indicator).all();

  return Response.json({
    country,
    indicator,
    data: rows.results,
  });
}
```

---

### Fase 7 — Panel de Indicadores (1-2 días)

#### Estructura del panel lateral
```
┌─────────────────────┐
│  INDICADORES        │
├─────────────────────┤
│ ✅ Inflación        │ ← activo
│ ○  PIB per cápita   │ ← próximamente
│ ○  Desempleo        │
│ ○  Deuda/PIB        │
│ ○  Tipo de cambio   │
└─────────────────────┘
```

Al hacer click en un indicador:
1. Se activa visualmente en el panel
2. El mapa cambia de color (choropleth) según los valores del país
3. Al hacer hover → tooltip muestra el valor del indicador
4. Al hacer click en un país → aparece gráfica histórica

---

## 📁 Estructura del Proyecto

```
macro-observer/
├── src/
│   ├── routes/
│   │   ├── +page.svelte          # Dashboard principal
│   │   └── login/+page.svelte    # Pantalla de login
│   ├── components/
│   │   ├── MapaMundo.svelte       # Mapa D3
│   │   ├── PanelIndicadores.svelte
│   │   ├── GraficaPais.svelte
│   │   └── Tooltip.svelte
│   └── lib/
│       └── api.ts                 # fetch helpers
├── functions/
│   └── api/
│       ├── auth/google/
│       │   ├── index.ts           # Redirige a Google
│       │   └── callback.ts        # Recibe el token
│       ├── macro.ts               # Datos macroeconómicos
│       ├── session.ts             # Validar sesión activa
│       └── cron/
│           └── fetch-data.ts      # Actualización automática
├── schema.sql                     # Schema D1
├── wrangler.toml                  # Config Cloudflare
└── package.json
```

---

## ⚙️ Archivo `wrangler.toml`

```toml
name = "macro-observer"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".svelte-kit/cloudflare"

[[d1_databases]]
binding = "DB"
database_name = "macro-db"
database_id = "TU_DATABASE_ID_AQUI"

[[kv_namespaces]]
binding = "SESSIONS"
id = "TU_KV_ID_AQUI"

[vars]
GOOGLE_CLIENT_ID = "TU_CLIENT_ID"

[[triggers]]
crons = ["0 6 * * *"]
```

> ⚠️ `GOOGLE_CLIENT_SECRET` se agrega como secret cifrado, nunca en el archivo:
> ```bash
> npx wrangler secret put GOOGLE_CLIENT_SECRET
> ```

---

## 🚀 Deploy

```bash
# Desarrollo local
npx wrangler pages dev

# Deploy a producción (o automático desde GitHub)
npx wrangler pages deploy .svelte-kit/cloudflare

# Aplicar schema a D1 en producción
npx wrangler d1 execute macro-db --file=./schema.sql --remote
```

---

## 📊 Indicadores Planificados

| Indicador | Código World Bank | Estado |
|---|---|---|
| Inflación | `FP.CPI.TOTL.ZG` | ✅ Fase 1 |
| PIB per cápita | `NY.GDP.PCAP.CD` | 🔜 Fase 2 |
| Desempleo | `SL.UEM.TOTL.ZS` | 🔜 Fase 2 |
| Deuda/PIB | `GC.DOD.TOTL.GD.ZS` | 🔜 Fase 2 |
| Tipo de cambio | `PA.NUS.FCRF` | 🔜 Fase 2 |

---

## 🔗 Referencias

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers KV](https://developers.cloudflare.com/kv/)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [World Bank API Docs](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)
- [World Atlas TopoJSON](https://github.com/topojson/world-atlas)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [D3.js Geo Docs](https://d3js.org/d3-geo)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

---

*Generado con Claude · MacroObserver v0.1*
