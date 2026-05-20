import type { IndicatorConfig } from './index';

export const debt: IndicatorConfig = {
	id: 'debt',
	label: 'Deuda/PIB',
	description: 'Deuda bruta del gobierno central como porcentaje del PIB. Indica cuánto debe el Estado en relación con el tamaño de su economía.',
	code: 'GC.DOD.TOTL.GD.ZS',
	unit: '%',
	colorHigh: 'bad',
	available: true,
};
