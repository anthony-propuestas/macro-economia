import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOECDIndicator } from './fetchOECDIndicator';

function makeDb() {
	const mockRun = vi.fn().mockResolvedValue({});
	const mockBind = vi.fn().mockReturnValue({ run: mockRun });
	const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
	const mockBatch = vi.fn().mockResolvedValue([]);
	return { prepare: mockPrepare, batch: mockBatch, _run: mockRun, _bind: mockBind } as any;
}

function makeSDMXResponse(countryCodes: string[], years: string[], values: (number | null)[][]) {
	const refAreaValues = countryCodes.map((id) => ({ id, name: id }));
	const timePeriodValues = years.map((id) => ({ id }));

	const series: Record<string, { observations: Record<string, (number | null)[]> }> = {};
	countryCodes.forEach((_, ci) => {
		const obs: Record<string, (number | null)[]> = {};
		years.forEach((_, yi) => {
			obs[String(yi)] = [values[ci][yi]];
		});
		series[`${ci}`] = { observations: obs };
	});

	return {
		data: {
			structure: {
				dimensions: {
					series: [{ id: 'REF_AREA', values: refAreaValues }],
					observation: [{ id: 'TIME_PERIOD', values: timePeriodValues }],
				},
			},
			dataSets: [{ series }],
		},
	};
}

const SDMX_PATH = 'OECD.DAF.INV,DSD_FDI@DF_FDI_AGG/A..W2.IN.USD.T';
const INDICATOR_ID = 'fdi_inflows';

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('fetchOECDIndicator', () => {
	it('inserta datos válidos y registra ok', async () => {
		const db = makeDb();
		const payload = makeSDMXResponse(['ARG', 'BRA'], ['2023', '2022'], [
			[100, 200],
			[300, 400],
		]);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

		await fetchOECDIndicator(db, SDMX_PATH, INDICATOR_ID);

		expect(db.batch).toHaveBeenCalledOnce();
		const [batch] = db.batch.mock.calls[0];
		expect(batch).toHaveLength(4);
		expect(db._bind).toHaveBeenCalledWith(INDICATOR_ID, 'ok', 4, 0, null, expect.any(String));
	});

	it('filtra country codes que no son ISO3', async () => {
		const db = makeDb();
		const payload = makeSDMXResponse(['ARG', 'EU', 'BRA'], ['2023'], [[10], [20], [30]]);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

		await fetchOECDIndicator(db, SDMX_PATH, INDICATOR_ID);

		const [batch] = db.batch.mock.calls[0];
		expect(batch).toHaveLength(2); // ARG y BRA, no EU
		expect(db._bind).toHaveBeenCalledWith(INDICATOR_ID, 'ok', 2, 1, null, expect.any(String));
	});

	it('filtra valores null', async () => {
		const db = makeDb();
		const payload = makeSDMXResponse(['ARG'], ['2023', '2022'], [[10, null]]);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

		await fetchOECDIndicator(db, SDMX_PATH, INDICATOR_ID);

		const [batch] = db.batch.mock.calls[0];
		expect(batch).toHaveLength(1);
		expect(db._bind).toHaveBeenCalledWith(INDICATOR_ID, 'ok', 1, 1, null, expect.any(String));
	});

	it('datasets vacíos: no llama batch, registra 0 records', async () => {
		const db = makeDb();
		const payload = { data: { structure: null, dataSets: null } };
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

		await fetchOECDIndicator(db, SDMX_PATH, INDICATOR_ID);

		expect(db.batch).not.toHaveBeenCalled();
		expect(db._bind).toHaveBeenCalledWith(INDICATOR_ID, 'ok', 0, 0, null, expect.any(String));
	});

	it('REF_AREA no encontrado: registra error', async () => {
		const db = makeDb();
		const payload = {
			data: {
				structure: {
					dimensions: {
						series: [{ id: 'OTHER_DIM', values: [] }],
						observation: [{ id: 'TIME_PERIOD', values: [] }],
					},
				},
				dataSets: [{ series: {} }],
			},
		};
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

		await fetchOECDIndicator(db, SDMX_PATH, INDICATOR_ID);

		expect(db._bind).toHaveBeenCalledWith(
			INDICATOR_ID,
			'error',
			0,
			0,
			'REF_AREA dimension not found in SDMX response',
			expect.any(String)
		);
	});

	it('error de fetch: registra error en log', async () => {
		vi.useFakeTimers();
		try {
			const db = makeDb();
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

			const promise = fetchOECDIndicator(db, SDMX_PATH, INDICATOR_ID);
			await vi.runAllTimersAsync();
			await promise;

			expect(db.batch).not.toHaveBeenCalled();
			expect(db._bind).toHaveBeenCalledWith(
				INDICATOR_ID,
				'error',
				0,
				0,
				'connection refused',
				expect.any(String)
			);
		} finally {
			vi.useRealTimers();
		}
	});
});
