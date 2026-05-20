import { describe, it, expect } from 'vitest';
import { indicators, indicatorMap } from './index';

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

	it('debt, exchange, gdp, unemployment están disponibles', () => {
		for (const id of ['debt', 'exchange', 'gdp', 'unemployment']) {
			expect(indicatorMap.get(id)?.available).toBe(true);
		}
	});

	it('current_account, fiscal_balance, reserves, fdi_inflows están disponibles', () => {
		for (const id of ['current_account', 'fiscal_balance', 'reserves', 'fdi_inflows']) {
			expect(indicatorMap.get(id)?.available).toBe(true);
		}
	});
});
