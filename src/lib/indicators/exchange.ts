import type { IndicatorConfig } from './index';

export const exchange: IndicatorConfig = {
	id: 'exchange',
	label: 'Tipo de cambio',
	description: 'Unidades de moneda local necesarias para comprar 1 dólar (promedio anual oficial). Refleja la fortaleza relativa de la moneda.',
	code: 'PA.NUS.FCRF',
	unit: '',
	colorHigh: 'bad',
	available: true,
};
