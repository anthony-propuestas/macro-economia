<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js';
	import { fetchCountryData } from '$lib/api';
	import { indicatorMap } from '$lib/indicators/index';

	Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

	let { country, name, indicator }: {
		country: string;
		name: string;
		indicator: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement>(null!);
	let chart: Chart | null = null;
	let loading = $state(false);
	let error = $state('');

	async function loadData(c: string, ind: string) {
		loading = true;
		error = '';
		try {
			const data = await fetchCountryData(c, ind);
			const sorted = [...data].sort((a, b) => a.year - b.year);
			const labels = sorted.map((d) => String(d.year));
			const values = sorted.map((d) => d.value);

			if (chart) chart.destroy();
			chart = new Chart(canvas, {
				type: 'line',
				data: {
					labels,
					datasets: [{
						label: (() => { const c = indicatorMap.get(ind); return c ? `${c.label}${c.unit ? ' (' + c.unit + ')' : ''}` : ind; })(),
						data: values,
						borderColor: '#3b82f6',
						backgroundColor: 'rgba(59,130,246,0.1)',
						fill: true,
						tension: 0.3,
						pointRadius: 3,
					}],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: { tooltip: { mode: 'index', intersect: false } },
					scales: {
						x: { ticks: { color: '#8892a4', maxTicksLimit: 8 }, grid: { color: '#2e3347' } },
						y: { ticks: { color: '#8892a4' }, grid: { color: '#2e3347' } },
					},
				},
			});
		} catch {
			error = 'No hay datos disponibles';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (canvas && country) loadData(country, indicator);
	});

	onDestroy(() => chart?.destroy());
</script>

<div class="chart-panel">
	<div class="chart-header">
		<span class="country-name">{name}</span>
		<span class="indicator-label">{indicatorMap.get(indicator)?.label ?? indicator} histórica</span>
	</div>
	{#if loading}
		<div class="state">Cargando…</div>
	{:else if error}
		<div class="state error">{error}</div>
	{:else}
		<div class="chart-wrap">
			<canvas bind:this={canvas}></canvas>
		</div>
	{/if}
</div>

<style>
	.chart-panel {
		padding: 1rem;
		border-top: 1px solid var(--border);
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 220px;
	}

	.chart-header {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-bottom: 0.75rem;
	}

	.country-name { font-weight: 600; font-size: 0.9rem; }
	.indicator-label { font-size: 0.75rem; color: var(--text-muted); }

	.chart-wrap { flex: 1; position: relative; min-height: 160px; }

	.state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.state.error { color: var(--danger); }
</style>
