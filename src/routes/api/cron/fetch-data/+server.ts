import type { RequestHandler } from './$types';
import type { D1Database } from '@cloudflare/workers-types';

export const GET: RequestHandler = async ({ platform, url }) => {
	const db = platform?.env?.DB as D1Database | undefined;
	const cronSecret = platform?.env?.CRON_SECRET as string | undefined;
	const token = url.searchParams.get('token');

	if (!cronSecret || token !== cronSecret) {
		return new Response('Forbidden', { status: 403 });
	}

	if (!db) {
		return Response.json({ error: 'DB no disponible' }, { status: 503 });
	}

	const indicators = [
		{ id: 'inflation',    code: 'FP.CPI.TOTL.ZG'   },
		{ id: 'gdp',          code: 'NY.GDP.PCAP.CD'    },
		{ id: 'unemployment', code: 'SL.UEM.TOTL.ZS'   },
		{ id: 'debt',         code: 'GC.DOD.TOTL.GD.ZS' },
		{ id: 'exchange',     code: 'PA.NUS.FCRF'        },
	];

	for (const { code, id } of indicators) {
		await fetchIndicator(db, code, id);
	}

	return Response.json({ ok: true });
};

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
