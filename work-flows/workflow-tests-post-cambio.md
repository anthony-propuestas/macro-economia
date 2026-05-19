# Workflow: Tests Post-Cambio

Ejecutar ante cualquier cambio antes de commitear.

---

## Si los tests aún no están configurados

### Configurar Vitest para SvelteKit (una sola vez)

```bash
npm install -D @sveltejs/kit vitest @testing-library/svelte jsdom
```

Crear `vitest.config.ts` en la raíz:

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
  resolve: {
    alias: { $lib: '/src/lib' },
  },
});
```

Crear `src/tests/setup.ts`:

```ts
import '@testing-library/svelte/vitest';
```

Agregar script en `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

---

## Checklist rápida (cuando tests están activos)

- [ ] Tests creados para archivos nuevos
- [ ] Tests existentes actualizados para archivos modificados
- [ ] Tests obsoletos eliminados
- [ ] `npm test` pasa sin errores

---

## Qué testear en este proyecto

### Tipo A — Componente Svelte

**Qué testea:** qué renderiza el componente según sus props.  
**Archivos objetivo:** [PanelIndicadores.svelte](../src/lib/components/PanelIndicadores.svelte), [MapaMundo.svelte](../src/lib/components/MapaMundo.svelte), [GraficaPais.svelte](../src/lib/components/GraficaPais.svelte)

**Patrón:**

```ts
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import PanelIndicadores from '$lib/components/PanelIndicadores.svelte';

describe('PanelIndicadores', () => {
  it('renderiza todos los indicadores disponibles', () => {
    render(PanelIndicadores, { props: { active: 'inflation' } });
    expect(screen.getByText('Inflación')).toBeInTheDocument();
    expect(screen.getByText('PIB per cápita')).toBeInTheDocument();
  });

  it('marca el indicador activo', () => {
    render(PanelIndicadores, { props: { active: 'gdp' } });
    const btn = screen.getByText('PIB per cápita').closest('button');
    expect(btn).toHaveClass('active');
  });

  it('deshabilita indicadores con available: false', () => {
    render(PanelIndicadores, { props: { active: 'inflation' } });
    // Si hubiera un indicador con available: false, estaría disabled
    const disabledBtns = document.querySelectorAll('button[disabled]');
    // Verificar count según los indicadores reales
  });
});
```

### Tipo B — Módulo TypeScript puro

**Qué testea:** funciones de utilidad, transformaciones de datos, config de indicadores.  
**Archivos objetivo:** [src/lib/indicators/index.ts](../src/lib/indicators/index.ts), [countryLookup.ts](../src/lib/countryLookup.ts), [api.ts](../src/lib/api.ts)

**Patrón:**

```ts
import { describe, it, expect } from 'vitest';
import { indicators, indicatorMap } from '$lib/indicators/index';

describe('indicators config', () => {
  it('todos los indicadores tienen id, label y code', () => {
    for (const ind of indicators) {
      expect(ind.id).toBeTruthy();
      expect(ind.label).toBeTruthy();
      expect(ind.code).toMatch(/^[A-Z0-9]{2,}\.[A-Z0-9.]+$/);
    }
  });

  it('indicatorMap tiene entrada para cada indicador', () => {
    for (const ind of indicators) {
      expect(indicatorMap.get(ind.id)).toBe(ind);
    }
  });
});
```

### Tipo C — Server function (Cloudflare Pages Function)

**Qué testea:** lógica del handler sin hacer requests reales.  
**Archivos objetivo:** [macro.ts](../functions/api/macro.ts), [cron/fetch-data.ts](../functions/api/cron/fetch-data.ts), [auth/logout.ts](../functions/api/auth/logout.ts), [auth/google/index.ts](../functions/api/auth/google/index.ts), [auth/google/callback.ts](../functions/api/auth/google/callback.ts)

**Nota:** Las Cloudflare Pages Functions usan la API de Workers (`EventContext`, `D1Database`, `KVNamespace`). Para testearlas hay que mockear esos objetos. Es más complejo — priorizar primero los Tipos A y B.

**Patrón básico (mock manual):**

```ts
import { describe, it, expect, vi } from 'vitest';
import { onRequestGet } from '../../functions/api/macro';

describe('GET /api/macro', () => {
  it('rechaza indicador inválido con 400', async () => {
    const context = {
      request: new Request('https://example.com/api/macro?indicator=fake'),
      env: { SESSIONS: { get: vi.fn().mockResolvedValue('{}') }, DB: {} },
      params: {},
      data: {},
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      next: vi.fn(),
    } as any;

    const res = await onRequestGet(context);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Indicador inválido');
  });
});
```

---

## Paso a paso al hacer un cambio

### Si los tests aún no están configurados

Documentar qué se verificó manualmente y bajo qué condiciones. Registrar en el commit message.

---

### Si los tests están activos

#### 1. Identificar qué cambió

```bash
git status
git diff HEAD
```

| Categoría | Acción |
|---|---|
| Archivo nuevo | Crear test hermano con el mismo nombre (`archivo.ts` → `archivo.test.ts`) |
| Archivo modificado | Revisar y actualizar su test hermano |
| Archivo eliminado | Eliminar su test hermano |

#### 2. Correr los tests

```bash
npm test
```

Todos deben pasar. Si alguno falla, corregir antes de commitear.
