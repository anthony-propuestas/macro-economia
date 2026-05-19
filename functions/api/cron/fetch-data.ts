import type { D1Database } from '@cloudflare/workers-types';

interface Env {
	DB: D1Database;
}

export async function scheduled(
	_event: ScheduledEvent,
	env: Env,
	_ctx: ExecutionContext
) {
	const indicators: { code: string; id: string }[] = [
		{ id: 'inflation',    code: 'FP.CPI.TOTL.ZG' },
		{ id: 'gdp',          code: 'NY.GDP.PCAP.CD'  },
		{ id: 'unemployment', code: 'SL.UEM.TOTL.ZS'  },
		{ id: 'debt',         code: 'GC.DOD.TOTL.GD.ZS'},
		{ id: 'exchange',     code: 'PA.NUS.FCRF'      },
	];

	for (const { code, id } of indicators) {
		await fetchIndicator(env.DB, code, id);
	}
}

async function fetchIndicator(db: D1Database, wbCode: string, indicatorId: string) {
	const url = `https://api.worldbank.org/v2/country/all/indicator/${wbCode}?format=json&per_page=500&mrv=5`;

	const res = await fetch(url);
	const [, data] = await res.json<[unknown, WorldBankEntry[]]>();

	if (!data?.length) return;

	const now = new Date().toISOString();
	const stmt = db.prepare(`
		INSERT OR REPLACE INTO macro_data
		  (country_code, country_name, indicator, year, value, source, updated_at)
		VALUES (?, ?, ?, ?, ?, 'world_bank', ?)
	`);

	const batch = data
		.filter((d) =>
			d.value !== null &&
			typeof d.value === 'number' &&
			/^[A-Z]{3}$/.test(d.countryiso3code) &&
			typeof d.country?.value === 'string' &&
			/^\d{4}$/.test(d.date)
		)
		.map((d) =>
			stmt.bind(d.countryiso3code, d.country.value, indicatorId, parseInt(d.date), d.value, now)
		);

	if (!batch.length) return;

	await db.batch(batch);

	await db.prepare(
		`INSERT INTO fetch_log (indicator, status, records, fetched_at) VALUES (?, 'ok', ?, ?)`
	).bind(indicatorId, batch.length, now).run();
}

interface WorldBankEntry {
	countryiso3code: string;
	country: { value: string };
	date: string;
	value: number | null;
}
