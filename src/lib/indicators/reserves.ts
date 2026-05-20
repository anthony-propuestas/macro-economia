import type { IndicatorConfig } from './index';

export const reserves: IndicatorConfig = {
	id: 'reserves',
	label: 'Reservas internacionales',
	description: 'Meses de importaciones que el país puede cubrir con sus reservas de divisas. Un valor de 3 meses o más se considera un nivel adecuado.',
	code: 'FI.RES.TOTL.MO',
	unit: 'meses',
	colorHigh: 'good',
	available: true,
};
