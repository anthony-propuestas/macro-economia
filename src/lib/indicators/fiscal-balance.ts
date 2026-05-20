import type { IndicatorConfig } from './index';

export const fiscalBalance: IndicatorConfig = {
	id: 'fiscal_balance',
	label: 'Balance fiscal',
	description: 'Diferencia entre ingresos y gastos del gobierno como % del PIB. Negativo indica déficit: el Estado gasta más de lo que recauda.',
	code: 'GC.NLD.TOTL.GD.ZS',
	unit: '% PIB',
	colorHigh: 'good',
	available: true,
};
