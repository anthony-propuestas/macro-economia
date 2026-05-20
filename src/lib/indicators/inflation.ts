import type { IndicatorConfig } from './index';

export const inflation: IndicatorConfig = {
	id: 'inflation',
	label: 'Inflación',
	description: 'Variación anual del nivel de precios al consumidor. Un valor alto significa que el dinero pierde poder de compra rápidamente.',
	code: 'FP.CPI.TOTL.ZG',
	unit: '%',
	colorHigh: 'bad',
	available: true,
};
