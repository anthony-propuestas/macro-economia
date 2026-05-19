<script lang="ts">
	import MapaMundo from '$lib/components/MapaMundo.svelte';
	import PanelIndicadores from '$lib/components/PanelIndicadores.svelte';
	import GraficaPais from '$lib/components/GraficaPais.svelte';

	let selectedIndicator = $state('inflation');
	let selectedCountry = $state<{ iso3: string; name: string } | null>(null);

	function onCountrySelect(iso3: string, name: string) {
		selectedCountry = { iso3, name };
	}

	function onIndicatorChange(indicator: string) {
		selectedIndicator = indicator;
	}
</script>

<div class="dashboard">
	<aside class="sidebar">
		<PanelIndicadores active={selectedIndicator} onChange={onIndicatorChange} />
		{#if selectedCountry}
			<GraficaPais country={selectedCountry.iso3} name={selectedCountry.name} indicator={selectedIndicator} />
		{/if}
	</aside>

	<main class="map-area">
		<MapaMundo indicator={selectedIndicator} {onCountrySelect} />
	</main>
</div>

<style>
	.dashboard {
		display: flex;
		height: calc(100vh - 48px);
		overflow: hidden;
	}

	.sidebar {
		width: 280px;
		min-width: 280px;
		background: var(--bg-2);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.map-area {
		flex: 1;
		overflow: hidden;
		position: relative;
		background: var(--bg);
	}
</style>
