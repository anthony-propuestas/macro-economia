import type { IndicatorConfig } from './index';

export const unemployment: IndicatorConfig = {
	id: 'unemployment',
	label: 'Desempleo',
	description: 'Porcentaje de la fuerza laboral activa que no tiene trabajo. Incluye solo a quienes buscan empleo activamente, no a quienes dejaron de buscar.',
	code: 'SL.UEM.TOTL.ZS',
	unit: '%',
	colorHigh: 'bad',
	available: true,
};
