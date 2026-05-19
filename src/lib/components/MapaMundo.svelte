<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { feature } from 'topojson-client';
	import type { Topology } from 'topojson-specification';
	import { countryLookup } from '$lib/countryLookup';
	import { fetchChoroplethData } from '$lib/api';
	import { indicatorMap } from '$lib/indicators/index';

	let { indicator = 'inflation', onCountrySelect }: {
		indicator?: string;
		onCountrySelect?: (iso3: string, name: string) => void;
	} = $props();

	let tooltip = $state({ visible: false, x: 0, y: 0, nombre: '', valor: '' });
	let choroplethMap = $state(new Map<string, number>());
	let svgEl: SVGSVGElement;
	let colorScale: d3.ScaleSequential<string>;

	const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

	function buildColorScale(values: number[]) {
		const config = indicatorMap.get(indicator);
		const max = Math.max(...values, 1);
		const domain: [number, number] = config?.colorHigh === 'good' ? [0, max] : [max, 0];
		return d3.scaleSequential(d3.interpolateRdYlGn).domain(domain);
	}

	function updateFill() {
		if (!svgEl || !colorScale) return;
		d3.select(svgEl).selectAll<SVGPathElement, { id: string }>('path.pais')
			.attr('fill', (d) => {
				const info = countryLookup.get(String(d.id).padStart(3, '0'));
				if (!info) return '#2e3347';
				const val = choroplethMap.get(info.iso3);
				return val !== undefined ? colorScale(val) : '#2e3347';
			});
	}

	$effect(() => {
		// Reload choropleth data when indicator changes
		fetchChoroplethData(indicator)
			.then((data) => {
				const map = new Map<string, number>();
				data.forEach((d) => map.set(d.country_code, d.value));
				choroplethMap = map;
				const vals = [...map.values()];
				if (vals.length) {
					colorScale = buildColorScale(vals);
					updateFill();
				}
			})
			.catch(() => {}); // graceful — no data yet
	});

	onMount(async () => {
		const world = await fetch(WORLD_URL).then((r) => r.json()) as Topology;
		const countries = feature(world, (world.objects as Record<string, Parameters<typeof feature>[1]>).countries);

		const width = svgEl.clientWidth || 960;
		const height = svgEl.clientHeight || 500;

		const projection = d3.geoNaturalEarth1()
			.scale(width / 6.3)
			.translate([width / 2, height / 2]);
		const path = d3.geoPath().projection(projection);

		const svg = d3.select(svgEl);

		svg.selectAll('path.pais')
			.data((countries as GeoJSON.FeatureCollection).features)
			.enter()
			.append('path')
			.attr('class', 'pais')
			.attr('d', path as unknown as (d: GeoJSON.Feature) => string)
			.attr('fill', '#3d5070')
			.attr('stroke', '#0d1c30')
			.attr('stroke-width', 0.5)
			.on('mouseover', (event: MouseEvent, d: GeoJSON.Feature) => {
				const key = String((d as { id?: unknown }).id).padStart(3, '0');
				const info = countryLookup.get(key);
				const iso3 = info?.iso3;
				const val = iso3 ? choroplethMap.get(iso3) : undefined;

				tooltip = {
					visible: true,
					x: event.clientX + 14,
					y: event.clientY - 10,
					nombre: info?.name ?? 'País desconocido',
					valor: val !== undefined ? val.toFixed(2) : 'Sin datos',
				};

				d3.select(event.currentTarget as SVGPathElement).attr('stroke', '#60a5fa').attr('stroke-width', 1.2);
			})
			.on('mousemove', (event: MouseEvent) => {
				tooltip = { ...tooltip, x: event.clientX + 14, y: event.clientY - 10 };
			})
			.on('mouseout', (event: MouseEvent) => {
				tooltip = { ...tooltip, visible: false };
				d3.select(event.currentTarget as SVGPathElement).attr('stroke', '#0d1c30').attr('stroke-width', 0.5);
			})
			.on('click', (_event: MouseEvent, d: GeoJSON.Feature) => {
				const key = String((d as { id?: unknown }).id).padStart(3, '0');
				const info = countryLookup.get(key);
				if (info) onCountrySelect?.(info.iso3, info.name);
			});

		updateFill();
	});
</script>

<svg bind:this={svgEl} class="world-map" viewBox="0 0 960 500" preserveAspectRatio="xMidYMid meet">
	<rect width="960" height="500" fill="#0d1c30"/>
</svg>

{#if tooltip.visible}
	<div class="tooltip" style="left:{tooltip.x}px; top:{tooltip.y}px">
		<strong>{tooltip.nombre}</strong>
		<span>{indicatorMap.get(indicator)?.label ?? indicator}: {tooltip.valor}{tooltip.valor !== 'Sin datos' ? (indicatorMap.get(indicator)?.unit ?? '') : ''}</span>
	</div>
{/if}

<style>
	.world-map {
		width: 100%;
		height: 100%;
		display: block;
	}

	.tooltip {
		position: fixed;
		background: rgba(15, 17, 23, 0.95);
		border: 1px solid #3b82f6;
		border-radius: 6px;
		padding: 0.4rem 0.7rem;
		pointer-events: none;
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.8rem;
	}

	.tooltip strong { color: #e2e8f0; }
	.tooltip span { color: #93c5fd; }
</style>
