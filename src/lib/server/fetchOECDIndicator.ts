import type { D1Database } from '@cloudflare/workers-types';

// OECD responses can be large; increase timeout
const FETCH_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2_000;
const D1_BATCH_LIMIT = 100;
const ISO3_RE = /^[A-Z]{3}$/;
const YEAR_RE = /^\d{4}$/;

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

async function fetchWithRetry(url: string): Promise<Response> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0)
			await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		try {
			const res = await fetch(url, { signal: controller.signal });
			clearTimeout(timer);
			if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
			return res;
		} catch (err) {
			clearTimeout(timer);
			lastError = err;
		}
	}
	throw lastError;
}

async function logFetch(
	db: D1Database,
	indicator: string,
	status: 'ok' | 'error',
	records: number,
	filteredOut: number,
	errorMessage: string | null,
	fetchedAt: string
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO fetch_log (indicator, status, records, filtered_out, error_message, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(indicator, status, records, filteredOut, errorMessage, fetchedAt)
		.run();
}

// SDMX-JSON types (OECD standard format)
interface SDMXDimensionValue {
	id: string;
	name?: string;
}

interface SDMXDimension {
	id: string;
	values: SDMXDimensionValue[];
}

interface SDMXStructure {
	dimensions: {
		series: SDMXDimension[];
		observation: SDMXDimension[];
	};
}

interface SDMXSeries {
	observations: Record<string, (number | null)[]>;
}

interface SDMXDataSet {
	series: Record<string, SDMXSeries>;
}

interface SDMXResponse {
	data: {
		dataSets: SDMXDataSet[];
		structure: SDMXStructure;
	};
}

/**
 * Fetches data from an OECD SDMX-JSON endpoint and inserts it into D1.
 *
 * @param sdmxPath - The SDMX data path including dataflow and key filter,
 *   e.g. "OECD.DAF.INV,DSD_FDI@DF_FDI_AGG/A..W2.IN.USD.T"
 */
export async function fetchOECDIndicator(
	db: D1Database,
	sdmxPath: string,
	indicatorId: string
): Promise<void> {
	const now = new Date().toISOString();
	const url = `https://sdmx.oecd.org/public/rest/data/${sdmxPath}/all?format=jsondata&lastNObservations=5`;

	try {
		const res = await fetchWithRetry(url);
		const payload = await res.json<SDMXResponse>();

		const structure = payload.data?.structure;
		const dataSet = payload.data?.dataSets?.[0];

		if (!structure || !dataSet) {
			await logFetch(db, indicatorId, 'ok', 0, 0, null, now);
			return;
		}

		const seriesDims = structure.dimensions.series;
		const obsDims = structure.dimensions.observation;

		const refAreaIdx = seriesDims.findIndex((d) => d.id === 'REF_AREA');
		if (refAreaIdx === -1) {
			throw new Error('REF_AREA dimension not found in SDMX response');
		}

		const timePeriods = obsDims.find((d) => d.id === 'TIME_PERIOD')?.values ?? [];

		const stmt = db.prepare(
			`INSERT OR REPLACE INTO macro_data (country_code, country_name, indicator, year, value, source, updated_at) VALUES (?, ?, ?, ?, ?, 'oecd', ?)`
		);

		const stmts: ReturnType<typeof stmt.bind>[] = [];
		let filteredOut = 0;

		for (const [seriesKey, seriesData] of Object.entries(dataSet.series)) {
			const keyParts = seriesKey.split(':');
			const countryIdx = parseInt(keyParts[refAreaIdx]);
			const countryEntry = seriesDims[refAreaIdx].values[countryIdx];
			const countryCode = countryEntry?.id ?? '';
			const countryName = countryEntry?.name ?? countryCode;

			if (!ISO3_RE.test(countryCode)) {
				filteredOut++;
				continue;
			}

			for (const [obsKey, obsValues] of Object.entries(seriesData.observations)) {
				const timeIdx = parseInt(obsKey);
				const year = timePeriods[timeIdx]?.id ?? '';
				const value = obsValues[0];

				if (!YEAR_RE.test(year) || value === null || typeof value !== 'number') {
					filteredOut++;
					continue;
				}
				stmts.push(
					stmt.bind(countryCode, countryName, indicatorId, parseInt(year), value, now)
				);
			}
		}

		for (const batch of chunk(stmts, D1_BATCH_LIMIT)) await db.batch(batch);
		await logFetch(db, indicatorId, 'ok', stmts.length, filteredOut, null, now);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		try {
			await logFetch(db, indicatorId, 'error', 0, 0, message, now);
		} catch {
			// noop
		}
	}
}
