import type { IndicatorConfig } from './index';

export const unemployment: IndicatorConfig = {
	id: 'unemployment',
	label: 'Desempleo',
	code: 'SL.UEM.TOTL.ZS',
	unit: '%',
	colorHigh: 'bad',
	available: true,
};
