export interface IndicatorConfig {
	id: string;
	label: string;
	code: string;
	unit: string;
	colorHigh: 'bad' | 'good';
	available: boolean;
	api?: 'world_bank' | 'imf' | 'oecd';
}

import { inflation } from './inflation';
import { gdp } from './gdp';
import { unemployment } from './unemployment';
import { debt } from './debt';
import { exchange } from './exchange';
import { currentAccount } from './current-account';
import { fiscalBalance } from './fiscal-balance';
import { reserves } from './reserves';
import { fdiInflows } from './fdi-inflows';

export const indicators: IndicatorConfig[] = [
	inflation,
	gdp,
	unemployment,
	debt,
	exchange,
	currentAccount,
	fiscalBalance,
	reserves,
	fdiInflows,
];

export const indicatorMap = new Map<string, IndicatorConfig>(
	indicators.map((ind) => [ind.id, ind])
);
