import type { IndicatorConfig } from './index';

export const debt: IndicatorConfig = {
	id: 'debt',
	label: 'Deuda/PIB',
	code: 'GC.DOD.TOTL.GD.ZS',
	unit: '%',
	colorHigh: 'bad',
	available: true,
};
