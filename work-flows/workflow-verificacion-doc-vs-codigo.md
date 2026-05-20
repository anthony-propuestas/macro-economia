# Workflow: Verificación Documentación vs Código

Ejecutar antes de commitear cuando el diff incluye al menos un archivo `.md`.  
El código es la fuente de verdad — el doc se ajusta al código, nunca al revés.

---

## Checklist rápida

- [ ] Identificados qué `.md` hay en el diff
- [ ] Cada `.md` modificado verificado contra su código fuente
- [ ] Discrepancias corregidas en el doc (no en el código)
- [ ] Sin menciones rotas del elemento cambiado en otros docs

---

## Paso 1 — Identificar qué `.md` fue modificado

```powershell
git diff --name-only HEAD | Where-Object { $_ -match "\.md$" }
```

Si ningún `.md` aparece en el output, este workflow no aplica — commitear normal.

---

## Paso 2 — Mapear cada `.md` a su código fuente

| Documento modificado | Código que debe reflejar |
|---|---|
| `README.md` | `package.json` (scripts), `wrangler.toml` (bindings, cron), `schema.sql`, `functions/api/` |
| `docs/INDICATORS.md` | `src/lib/indicators/index.ts`, `src/lib/server/fetchIMFIndicator.ts`, `src/lib/server/fetchOECDIndicator.ts` |
| `work-flows/agregar-nuevo-modulo.md` | Proceso real de agregar un indicador: `src/lib/indicators/`, `functions/api/cron/fetch-data.ts`, `functions/api/macro.ts` |
| `work-flows/workflow-documentacion.md` | Los archivos que realmente existen y hay que mantener |
| `work-flows/workflow-tests-post-cambio.md` | El estado real de tests en el proyecto |
| `work-flows/workflow-verificacion-doc-vs-codigo.md` | Este mismo proceso — comparar contra práctica actual |

---

## Paso 3 — Verificar cada doc modificado

### `README.md`

| Verificar | Cómo |
|---|---|
| Comandos `npm run` | Comparar contra scripts en `package.json` |
| Variables de entorno | Comparar contra las que usa `functions/api/auth/google/index.ts` y el `wrangler.toml` |
| Bindings (D1, KV) | Comparar contra los bloques `[[d1_databases]]` y `[[kv_namespaces]]` en `wrangler.toml` |
| Indicadores listados | Comparar contra el array `indicators` en `src/lib/indicators/index.ts` |
| Endpoints documentados | Comparar contra los archivos en `functions/api/` |

**Señal de discrepancia:** el README menciona un comando que no existe en `package.json`; lista un indicador que fue eliminado de `index.ts`; describe un endpoint con una ruta que ya no existe.

---

### `work-flows/agregar-nuevo-modulo.md`

| Verificar | Cómo |
|---|---|
| Pasos del checklist | ¿Algún paso nuevo es obligatorio que no está? ¿Algún paso ya no aplica? |
| Rutas de archivos | Confirmar que cada archivo mencionado existe con esa ruta exacta |
| Campos de `IndicatorConfig` | Comparar contra la interfaz en `src/lib/indicators/index.ts` |
| Array en `fetch-data.ts` | Confirmar la estructura `{ id, code }` contra el archivo real |
| `VALID_INDICATORS` en `macro.ts` | Confirmar que el array existe en `functions/api/macro.ts` |

**Señal de discrepancia:** el doc menciona un campo de `IndicatorConfig` que fue renombrado; la ruta de un archivo cambió; se agregó un paso obligatorio al proceso que no está documentado.

---

### `work-flows/*.md`

| Verificar | Cómo |
|---|---|
| Comandos | Ejecutar mentalmente cada comando — ¿sigue siendo correcto para este proyecto? |
| Referencias a archivos | Confirmar que los archivos mencionados existen con esos nombres |
| Pasos del proceso | ¿Se siguen en la práctica? ¿Algún paso quedó obsoleto? |

---

## Paso 4 — Acción ante discrepancia

**Regla única: el código manda.**

| Tipo de discrepancia | Qué hacer |
|---|---|
| Doc menciona archivo/endpoint/campo que ya no existe | Eliminar la mención del doc |
| Doc tiene rutas, comandos o nombres distintos al código real | Actualizar el doc para que coincida con el código |
| Doc no menciona algo que sí existe en el código | Agregar la entrada faltante al doc |
| El código parece incorrecto (bug) | No tocar el doc — primero arreglar el código |

---

## Paso 5 — Verificar referencias cruzadas

Un cambio (ej: renombrar un indicador) puede estar mencionado en múltiples docs.

```powershell
Get-ChildItem -Recurse -Include "*.md" | Select-String "nombre_del_indicador_o_archivo"
```

Para cada mención encontrada en un doc que no estaba en el diff, verificar que también sigue siendo correcta.

---

## Cuándo termina este workflow

Cuando todos los `.md` del diff reflejan exactamente lo que el código hace — sin entradas obsoletas, sin rutas incorrectas, sin comandos que ya no existen.

Solo entonces: commitear.
