import type { RequestHandler } from './$types';
import type { KVNamespace, D1Database } from '@cloudflare/workers-types';

const VALID_INDICATORS = ['inflation', 'gdp', 'unemployment', 'debt', 'exchange'];

export const GET: RequestHandler = async ({ platform, url, cookies }) => {
	const db = platform?.env?.DB as D1Database | undefined;
	const sessions = platform?.env?.SESSIONS as KVNamespace | undefined;

	const country = url.searchParams.get('country');
	const indicator = url.searchParams.get('indicator') ?? 'inflation';

	if (!VALID_INDICATORS.includes(indicator)) {
		return Response.json({ error: 'Indicador inválido' }, { status: 400 });
	}
	if (country && !/^[A-Z]{3}$/.test(country)) {
		return Response.json({ error: 'Código de país inválido' }, { status: 400 });
	}

	// Skip auth in dev when KV not available
	if (sessions) {
		const sessionId = cookies.get('session_id');
		if (!sessionId || !(await sessions.get(sessionId))) {
			return Response.json({ error: 'No autorizado' }, { status: 401 });
		}
	}

	if (!db) {
		return Response.json({ indicator, data: [] });
	}

	if (!country) {
		const rows = await db.prepare(`
			SELECT country_code, country_name, value, year
			FROM macro_data
			WHERE indicator = ?
			  AND year = (
			    SELECT MAX(year) FROM macro_data m2
			    WHERE m2.country_code = macro_data.country_code
			      AND m2.indicator = macro_data.indicator
			  )
			ORDER BY country_code
		`).bind(indicator).all();
		return Response.json({ indicator, data: rows.results });
	}

	const rows = await db.prepare(`
		SELECT year, value, country_name
		FROM macro_data
		WHERE country_code = ? AND indicator = ?
		ORDER BY year ASC
		LIMIT 20
	`).bind(country, indicator).all();
	return Response.json({ country, indicator, data: rows.results });
};
