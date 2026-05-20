import type { D1Database } from '@cloudflare/workers-types';

export interface IndicatorJob {
	id: string;
	code: string;
	api?: 'world_bank' | 'imf' | 'oecd';
}

interface WorldBankMeta {
	page: number;
	pages: number;
	per_page: number;
	total: number;
}

interface WorldBankEntry {
	countryiso3code: string;
	country: { value: string };
	date: string;
	value: number | null;
}

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2_000;
const D1_BATCH_LIMIT = 100;
const WB_PER_PAGE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		out.push(arr.slice(i, i + size));
	}
	return out;
}

async function fetchPage(
	wbCode: string,
	page: number
): Promise<[WorldBankMeta, WorldBankEntry[]]> {
	const url =
		`https://api.worldbank.org/v2/country/all/indicator/${wbCode}` +
		`?format=json&per_page=${WB_PER_PAGE}&mrv=5&page=${page}`;

	let lastError: unknown;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		try {
			const res = await fetch(url, { signal: controller.signal });
			clearTimeout(timer);

			if (!res.ok) {
				throw new Error(`HTTP ${res.status} ${res.statusText}`);
			}

			const payload = await res.json<[WorldBankMeta, WorldBankEntry[]]>();

			if (!Array.isArray(payload) || payload.length < 2) {
				throw new Error(`Unexpected API response shape for ${wbCode} page ${page}`);
			}

			const [meta, data] = payload;
			return [meta, data ?? []];
		} catch (err) {
			clearTimeout(timer);
			lastError = err;
		}
	}

	throw lastError;
}

export async function fetchIndicator(
	db: D1Database,
	wbCode: string,
	indicatorId: string
): Promise<void> {
	const now = new Date().toISOString();

	try {
		let totalPages = 1;
		const allEntries: WorldBankEntry[] = [];

		for (let page = 1; page <= totalPages; page++) {
			const [meta, entries] = await fetchPage(wbCode, page);
			if (page === 1) {
				totalPages = meta.pages ?? 1;
			}
			allEntries.push(...entries);
		}

		const valid = allEntries.filter(
			(d): d is WorldBankEntry & { country: { value: string } } =>
				d.value !== null &&
				typeof d.value === 'number' &&
				/^[A-Z]{3}$/.test(d.countryiso3code) &&
				typeof d.country?.value === 'string' &&
				/^\d{4}$/.test(d.date)
		);

		const filteredOut = allEntries.length - valid.length;

		if (valid.length === 0) {
			await logFetch(db, indicatorId, 'ok', 0, filteredOut, null, now);
			return;
		}

		const stmt = db.prepare(`
			INSERT OR REPLACE INTO macro_data
			  (country_code, country_name, indicator, year, value, source, updated_at)
			VALUES (?, ?, ?, ?, ?, 'world_bank', ?)
		`);

		const stmts = valid.map((d) =>
			stmt.bind(d.countryiso3code, d.country.value, indicatorId, parseInt(d.date), d.value, now)
		);

		for (const batch of chunk(stmts, D1_BATCH_LIMIT)) {
			await db.batch(batch);
		}

		await logFetch(db, indicatorId, 'ok', valid.length, filteredOut, null, now);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		try {
			await logFetch(db, indicatorId, 'error', 0, 0, message, now);
		} catch {
			// If logging fails, nothing else we can do inside a Worker.
		}
	}
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
			`INSERT INTO fetch_log
			   (indicator, status, records, filtered_out, error_message, fetched_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(indicator, status, records, filteredOut, errorMessage, fetchedAt)
		.run();
}
