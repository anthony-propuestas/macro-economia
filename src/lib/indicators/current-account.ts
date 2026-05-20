import type { IndicatorConfig } from './index';

export const currentAccount: IndicatorConfig = {
	id: 'current_account',
	label: 'Cuenta corriente',
	description: 'Balance de comercio exterior y transferencias como % del PIB. Positivo significa que el país exporta más de lo que importa (superávit); negativo, lo contrario.',
	code: 'BN.CAB.XOKA.GD.ZS',
	unit: '% PIB',
	colorHigh: 'good',
	available: true,
};
