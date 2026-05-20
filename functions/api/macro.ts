import type { EventContext, KVNamespace, D1Database } from '@cloudflare/workers-types';

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
	const { request, env } = context;
	const url = new URL(request.url);
	const VALID_INDICATORS = ['inflation', 'gdp', 'unemployment', 'debt', 'exchange', 'current_account', 'fiscal_balance', 'reserves', 'fdi_inflows'];
	const country = url.searchParams.get('country');
	const indicator = url.searchParams.get('indicator') ?? 'inflation';

	if (!VALID_INDICATORS.includes(indicator)) {
		return Response.json({ error: 'Indicador inválido' }, { status: 400 });
	}
	if (country && !/^[A-Z]{3}$/.test(country)) {
		return Response.json({ error: 'Código de país inválido' }, { status: 400 });
	}

	// Verify session
	const cookie = request.headers.get('Cookie') ?? '';
	const sessionId = cookie.match(/session_id=([^;]+)/)?.[1];
	if (!sessionId || !(await env.SESSIONS.get(sessionId))) {
		return Response.json({ error: 'No autorizado' }, { status: 401 });
	}

	// No country = choropleth: latest value per country
	if (!country) {
		const rows = await env.DB.prepare(`
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

	// Single country — last 20 years
	const rows = await env.DB.prepare(`
		SELECT year, value, country_name
		FROM macro_data
		WHERE country_code = ? AND indicator = ?
		ORDER BY year ASC
		LIMIT 20
	`).bind(country, indicator).all();

	return Response.json({ country, indicator, data: rows.results });
}

interface Env {
	DB: D1Database;
	SESSIONS: KVNamespace;
}
