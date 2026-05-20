import type { D1Database } from '@cloudflare/workers-types';

const FETCH_TIMEOUT_MS = 30_000;
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

interface IMFCountriesResponse {
	countries: Record<string, { label: string }>;
}

interface IMFDataResponse {
	values: Record<string, Record<string, Record<string, number | null>>>;
}

function buildPeriods(count: number): string {
	const year = new Date().getFullYear();
	return Array.from({ length: count }, (_, i) => year - i).join(',');
}

export async function fetchIMFIndicator(
	db: D1Database,
	imfCode: string,
	indicatorId: string
): Promise<void> {
	const now = new Date().toISOString();
	try {
		const [countriesRes, dataRes] = await Promise.all([
			fetchWithRetry('https://www.imf.org/external/datamapper/api/v1/countries'),
			fetchWithRetry(
				`https://www.imf.org/external/datamapper/api/v1/${imfCode}?periods=${buildPeriods(5)}`
			)
		]);

		const { countries } = await countriesRes.json<IMFCountriesResponse>();
		const { values } = await dataRes.json<IMFDataResponse>();

		const indicatorData = values?.[imfCode];
		if (!indicatorData) {
			await logFetch(db, indicatorId, 'ok', 0, 0, null, now);
			return;
		}

		const stmt = db.prepare(
			`INSERT OR REPLACE INTO macro_data (country_code, country_name, indicator, year, value, source, updated_at) VALUES (?, ?, ?, ?, ?, 'imf', ?)`
		);

		const stmts: ReturnType<typeof stmt.bind>[] = [];
		let filteredOut = 0;

		for (const [countryCode, yearMap] of Object.entries(indicatorData)) {
			if (!ISO3_RE.test(countryCode)) {
				filteredOut++;
				continue;
			}
			const countryName = countries[countryCode]?.label ?? countryCode;

			for (const [year, value] of Object.entries(yearMap)) {
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
