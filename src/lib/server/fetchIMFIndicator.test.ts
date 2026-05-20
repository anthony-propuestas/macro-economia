import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchIMFIndicator } from './fetchIMFIndicator';

function makeDb() {
	const mockRun = vi.fn().mockResolvedValue({});
	const mockBind = vi.fn().mockReturnValue({ run: mockRun });
	const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
	const mockBatch = vi.fn().mockResolvedValue([]);
	return { prepare: mockPrepare, batch: mockBatch, _run: mockRun, _bind: mockBind } as any;
}

function makeIMFResponse(imfCode: string, data: Record<string, Record<string, number | null>>) {
	return {
		countries: { ARG: { label: 'Argentina' }, BRA: { label: 'Brazil' } },
		values: { [imfCode]: data },
	};
}

const IMF_CODE = 'BCA_NGDPD';
const INDICATOR_ID = 'current_account';

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('fetchIMFIndicator', () => {
	it('inserta datos válidos y registra ok', async () => {
		const db = makeDb();
		vi.stubGlobal(
			'fetch',
			vi.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ countries: { ARG: { label: 'Argentina' } } }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () =>
						makeIMFResponse(IMF_CODE, { ARG: { '2023': 1.5, '2022': -0.3 } }),
				})
		);

		await fetchIMFIndicator(db, IMF_CODE, INDICATOR_ID);

		expect(db.batch).toHaveBeenCalledOnce();
		const [batch] = db.batch.mock.calls[0];
		expect(batch).toHaveLength(2);

		// logFetch 'ok'
		expect(db._bind).toHaveBeenCalledWith(INDICATOR_ID, 'ok', 2, 0, null, expect.any(String));
	});

	it('filtra country codes que no son ISO3', async () => {
		const db = makeDb();
		vi.stubGlobal(
			'fetch',
			vi.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ countries: {} }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () =>
						makeIMFResponse(IMF_CODE, {
							ARG: { '2023': 1.0 }, // válido
							EU: { '2023': 2.0 },  // inválido: solo 2 letras
							'ABC-': { '2023': 3.0 }, // inválido: tiene guion
						}),
				})
		);

		await fetchIMFIndicator(db, IMF_CODE, INDICATOR_ID);

		const [batch] = db.batch.mock.calls[0];
		expect(batch).toHaveLength(1);
		expect(db._bind).toHaveBeenCalledWith(INDICATOR_ID, 'ok', 1, 2, null, expect.any(String));
	});

	it('filtra años malformados y valores null', async () => {
		const db = makeDb();
		vi.stubGlobal(
			'fetch',
			vi.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ countries: { ARG: { label: 'Argentina' } } }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () =>
						makeIMFResponse(IMF_CODE, {
							ARG: {
								'2023': 1.5,     // válido
								'20XX': 2.0,     // año malformado
								'2022': null,    // valor null
							},
						}),
				})
		);

		await fetchIMFIndicator(db, IMF_CODE, INDICATOR_ID);

		const [batch] = db.batch.mock.calls[0];
		expect(batch).toHaveLength(1);
		expect(db._bind).toHaveBeenCalledWith(INDICATOR_ID, 'ok', 1, 2, null, expect.any(String));
	});

	it('sin datos para el indicador: no llama batch, registra 0 records', async () => {
		const db = makeDb();
		vi.stubGlobal(
			'fetch',
			vi.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ countries: {} }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ values: {} }), // imfCode ausente
				})
		);

		await fetchIMFIndicator(db, IMF_CODE, INDICATOR_ID);

		expect(db.batch).not.toHaveBeenCalled();
		expect(db._bind).toHaveBeenCalledWith(INDICATOR_ID, 'ok', 0, 0, null, expect.any(String));
	});

	it('error de fetch: registra error en log', async () => {
		vi.useFakeTimers();
		try {
			const db = makeDb();
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network timeout')));

			const promise = fetchIMFIndicator(db, IMF_CODE, INDICATOR_ID);
			await vi.runAllTimersAsync();
			await promise;

			expect(db.batch).not.toHaveBeenCalled();
			expect(db._bind).toHaveBeenCalledWith(
				INDICATOR_ID,
				'error',
				0,
				0,
				'network timeout',
				expect.any(String)
			);
		} finally {
			vi.useRealTimers();
		}
	});
});
