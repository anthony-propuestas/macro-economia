import type { IndicatorConfig } from './index';

export const gdp: IndicatorConfig = {
	id: 'gdp',
	label: 'PIB per cápita',
	description: 'Valor de todos los bienes y servicios producidos en el país dividido entre su población, en dólares. Refleja el nivel de vida económico promedio.',
	code: 'NY.GDP.PCAP.CD',
	unit: 'USD',
	colorHigh: 'good',
	available: true,
};
