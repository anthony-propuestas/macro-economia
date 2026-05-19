import type { IndicatorConfig } from './index';

export const inflation: IndicatorConfig = {
	id: 'inflation',
	label: 'Inflación',
	code: 'FP.CPI.TOTL.ZG',
	unit: '%',
	colorHigh: 'bad',
	available: true,
};
