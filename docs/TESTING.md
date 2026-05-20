# Testing

## Stack

| Herramienta | Versión | Rol |
|---|---|---|
| [Vitest](https://vitest.dev/) | 4.1 | Test runner, assertions, mocks |
| jsdom | 29 | Entorno DOM para tests sin browser real |

Configuración en `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    environment: 'jsdom',  // simula window, document, etc.
    globals: true,         // describe/it/expect disponibles sin import
  },
  resolve: {
    alias: { $lib: '/src/lib' },  // mismo alias que SvelteKit
  },
});
```

## Ejecutar los tests

```bash
# Una sola vez (para CI o pre-commit)
npm run test

# Modo watch — re-ejecuta al guardar archivos
npm run test:watch
```

Salida esperada:

```
✓ src/lib/indicators/index.test.ts (3)
  ✓ indicators config > todos los indicadores tienen id, label y code
  ✓ indicators config > indicatorMap tiene entrada para cada indicador
  ✓ indicators config > debt, exchange, gdp, unemployment están disponibles

Test Files  1 passed (1)
Tests       3 passed (3)
```

## Suite actual

### `src/lib/indicators/index.test.ts`

Verifica la integridad de la configuración de los 5 indicadores macroeconómicos.

| Test | Qué verifica |
|---|---|
| `todos los indicadores tienen id, label y code` | Cada indicador tiene campos no vacíos y `code` con formato World Bank (`FP.CPI.TOTL.ZG`) |
| `indicatorMap tiene entrada para cada indicador` | El `Map<string, IndicatorConfig>` exportado contiene exactamente los mismos indicadores que el array `indicators` |
| `debt, exchange, gdp, unemployment están disponibles` | Esos 4 indicadores tienen `available: true` (requisito del dashboard) |

Si falla el primer test al agregar un indicador nuevo, revisar que `code` cumpla el regex `/^[A-Z0-9]{2,}\.[A-Z0-9.]+$/`.

## Cómo escribir tests nuevos

### Convención de archivos

El test va junto al módulo que testea:

```
src/lib/indicators/index.ts       → src/lib/indicators/index.test.ts  ✓ (existe)
src/lib/countryLookup.ts          → src/lib/countryLookup.test.ts
src/lib/api.ts                    → src/lib/api.test.ts
src/lib/components/MapaMundo.svelte → src/lib/components/MapaMundo.test.ts
```

Nombre del `describe` = nombre del módulo o función principal.

---

### Tipo A — Módulo TypeScript puro

Para: `src/lib/indicators/`, `src/lib/countryLookup.ts`, `src/lib/api.ts`

```ts
import { describe, it, expect } from 'vitest';
import { indicators, indicatorMap } from '$lib/indicators/index';

describe('indicators config', () => {
  it('todos tienen code con formato World Bank', () => {
    for (const ind of indicators) {
      expect(ind.code).toMatch(/^[A-Z0-9]{2,}\.[A-Z0-9.]+$/);
    }
  });
});
```

No requiere instalación extra — funciona con la config actual.

---

### Tipo B — Componente Svelte

Para: `src/lib/components/PanelIndicadores.svelte`, `MapaMundo.svelte`, `GraficaPais.svelte`

Requiere instalar `@testing-library/svelte`:

```bash
npm install -D @testing-library/svelte @testing-library/jest-dom
```

Actualizar `vitest.config.ts` para agregar setup:

```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/tests/setup.ts'],  // agregar esta línea
}
```

Crear `src/tests/setup.ts`:

```ts
import '@testing-library/jest-dom';
```

Ejemplo de test de componente:

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
});
```

---

### Tipo C — Handler de API (rutas SvelteKit)

Para: `src/routes/api/macro/+server.ts`, `src/routes/api/cron/fetch-data/+server.ts`

Requiere mock manual de los bindings de Cloudflare (`DB`, `SESSIONS`) usando `vi.fn()`.

```ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from '$routes/api/macro/+server';

describe('GET /api/macro', () => {
  it('rechaza indicador inválido con 400', async () => {
    const mockEvent = {
      url: new URL('http://localhost/api/macro?indicator=fake'),
      cookies: { get: vi.fn().mockReturnValue('session-123') },
      platform: {
        env: {
          SESSIONS: { get: vi.fn().mockResolvedValue('{}') },
          DB: { prepare: vi.fn() },
        },
      },
    } as any;

    const res = await GET(mockEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Indicador inválido');
  });
});
```

---

## Cobertura actual

| Módulo | Cubierto | Tipo |
|---|---|---|
| `src/lib/indicators/index.ts` | ✅ 3 tests | A |
| `src/lib/countryLookup.ts` | ❌ | A |
| `src/lib/api.ts` | ❌ | A |
| `src/lib/server/fetchIndicator.ts` | ❌ | A (con mocks de D1) |
| `src/lib/components/*.svelte` | ❌ | B (requiere instalación) |
| `src/routes/api/**` | ❌ | C (requiere mocks) |

## Checklist pre-commit

- [ ] `npm run test` pasa sin errores
- [ ] Si se agregó un indicador nuevo: el test de `index.test.ts` sigue pasando
- [ ] Si se modificó lógica existente: actualizar el test hermano
- [ ] Si se eliminó un módulo: eliminar su `.test.ts`
