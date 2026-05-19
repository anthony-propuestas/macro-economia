import type { EventContext, D1Database } from '@cloudflare/workers-types';
import { fetchIndicator, type IndicatorJob } from '../../src/lib/server/fetchIndicator';

interface Env {
	DB: D1Database;
	CRON_SECRET: string;
}

const INDICATORS: IndicatorJob[] = [
	{ id: 'inflation',    code: 'FP.CPI.TOTL.ZG'    },
	{ id: 'gdp',          code: 'NY.GDP.PCAP.CD'     },
	{ id: 'unemployment', code: 'SL.UEM.TOTL.ZS'    },
	{ id: 'debt',         code: 'GC.DOD.TOTL.GD.ZS' },
	{ id: 'exchange',     code: 'PA.NUS.FCRF'         },
];

async function runFetch(db: D1Database): Promise<void> {
	await Promise.allSettled(INDICATORS.map(({ id, code }) => fetchIndicator(db, code, id)));
}

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
	const { request, env } = context;
	const url = new URL(request.url);
	const token = url.searchParams.get('token');

	if (!env.CRON_SECRET || token !== env.CRON_SECRET) {
		return new Response('Forbidden', { status: 403 });
	}

	await runFetch(env.DB);
	return Response.json({ ok: true });
}

export async function scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
	await runFetch(env.DB);
}
