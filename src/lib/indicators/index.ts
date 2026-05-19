export interface IndicatorConfig {
	id: string;
	label: string;
	code: string;
	unit: string;
	colorHigh: 'bad' | 'good';
	available: boolean;
}

import { inflation } from './inflation';
import { gdp } from './gdp';
import { unemployment } from './unemployment';
import { debt } from './debt';
import { exchange } from './exchange';

export const indicators: IndicatorConfig[] = [
	inflation,
	gdp,
	unemployment,
	debt,
	exchange,
];

export const indicatorMap = new Map<string, IndicatorConfig>(
	indicators.map((ind) => [ind.id, ind])
);
