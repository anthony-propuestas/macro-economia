# Workflow de Documentación Post-Cambio

Ejecutar después de **cualquier** cambio de código antes de cerrar la tarea.

---

## Checklist rápida

- [ ] `README.md` refleja el estado actual del sistema
- [ ] `schema.sql` refleja el schema actual de la DB
- [ ] `wrangler.toml` refleja los bindings y cron triggers actuales
- [ ] `work-flows/*.md` refleja el proceso real (si cambió algún flujo de trabajo)

> Solo marcar los que aplican al cambio. Si un archivo no fue afectado, omitirlo.

---

## Paso 1 — README.md

Actualizar solo las secciones afectadas por el cambio:

| Situación | Sección a actualizar |
|---|---|
| Se agregó o eliminó un indicador | Sección de indicadores/features |
| Cambió una variable de entorno | Sección de configuración / variables |
| Cambió un comando `npm run` | Sección de comandos |
| Cambió el stack (nueva dependencia principal) | Sección de tech stack |
| Cambió el flujo de auth o sesiones | Sección de autenticación |
| Cambió el cron trigger | Sección de cron / datos |

No tocar secciones que no fueron afectadas.

---

## Paso 2 — schema.sql

Actualizar si cambió el schema de la base de datos:

| Situación | Acción |
|---|---|
| Nueva tabla | Agregar el `CREATE TABLE` con sus índices |
| Columna agregada | Agregar `ALTER TABLE` o actualizar el `CREATE TABLE` si aún no está en producción |
| Tabla eliminada | Eliminar la definición y sus índices |
| Solo cambio de lógica (sin DDL) | No aplica |

`schema.sql` es la fuente de verdad del schema — no las queries en el código.

**Para aplicar cambios al D1 local:**
```bash
npx wrangler d1 execute macro-db --local --file=schema.sql
```

**Para producción:**
```bash
npx wrangler d1 execute macro-db --remote --file=schema.sql
```

---

## Paso 3 — wrangler.toml

Actualizar si cambió la configuración de Cloudflare:

| Situación | Acción |
|---|---|
| Nueva base de datos D1 | Agregar bloque `[[d1_databases]]` |
| Nuevo namespace KV | Agregar bloque `[[kv_namespaces]]` |
| Nuevo cron trigger | Agregar bloque `[[triggers]] crons` |
| Cambio en `pages_build_output_dir` | Actualizar el campo |
| Cambio en `compatibility_date` | Actualizar el campo |

Si no cambió la infraestructura de Cloudflare, no tocar este archivo.

---

## Paso 4 — work-flows/*.md

Actualizar si cambió algún proceso de trabajo:

| Situación | Acción |
|---|---|
| Se agregó o eliminó un archivo doc | Actualizar la tabla de mapeo en `workflow-verificacion-doc-vs-codigo.md` |
| Cambió el proceso de agregar un indicador | Actualizar `agregar-nuevo-modulo.md` |
| Cambió qué archivos hay que mantener actualizados | Actualizar este mismo archivo |

Aplica solo cuando el proceso documentado cambió. Un cambio de código que no altera el flujo de trabajo no requiere tocar estos archivos.

---

## Después de este workflow

Si modificaste al menos un `.md`: ejecutar `workflow-verificacion-doc-vs-codigo.md` para confirmar que cada doc modificado coincide con su código fuente.
