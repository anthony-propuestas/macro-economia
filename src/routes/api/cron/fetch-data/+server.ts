import type { RequestHandler } from './$types';
import type { D1Database } from '@cloudflare/workers-types';
import { fetchIndicator, type IndicatorJob } from '$lib/server/fetchIndicator';

const INDICATORS: IndicatorJob[] = [
	{ id: 'inflation',       code: 'FP.CPI.TOTL.ZG'    },
	{ id: 'gdp',             code: 'NY.GDP.PCAP.CD'     },
	{ id: 'unemployment',    code: 'SL.UEM.TOTL.ZS'    },
	{ id: 'debt',            code: 'GC.DOD.TOTL.GD.ZS' },
	{ id: 'exchange',        code: 'PA.NUS.FCRF'        },
	{ id: 'current_account', code: 'BN.CAB.XOKA.GD.ZS' },
	{ id: 'fiscal_balance',  code: 'GC.NLD.TOTL.GD.ZS' },
	{ id: 'reserves',        code: 'FI.RES.TOTL.MO'    },
	{ id: 'fdi_inflows',     code: 'BX.KLT.DINV.CD.WD' },
];

export const GET: RequestHandler = async ({ platform, url }) => {
	const db = platform?.env?.DB as D1Database | undefined;
	const cronSecret = platform?.env?.CRON_SECRET;
	const token = url.searchParams.get('token');

	if (!cronSecret || token !== cronSecret) {
		return new Response('Forbidden', { status: 403 });
	}

	if (!db) {
		return Response.json({ error: 'DB no disponible' }, { status: 503 });
	}

	await Promise.allSettled(INDICATORS.map((job) => fetchIndicator(db, job.code, job.id)));

	return Response.json({ ok: true });
};
