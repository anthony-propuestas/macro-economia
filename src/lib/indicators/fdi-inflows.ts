import type { IndicatorConfig } from './index';

export const fdiInflows: IndicatorConfig = {
	id: 'fdi_inflows',
	label: 'IED entradas netas',
	description: 'Inversión extranjera directa neta que entra al país en dólares. Refleja el atractivo del país para inversores de largo plazo. Puede ser negativa si hay desinversión.',
	code: 'BX.KLT.DINV.CD.WD',
	unit: 'USD',
	colorHigh: 'good',
	available: true,
};
