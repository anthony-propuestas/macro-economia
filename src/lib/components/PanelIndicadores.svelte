<script lang="ts">
	import { indicators } from '$lib/indicators/index';

	let { active = 'inflation', onChange }: {
		active?: string;
		onChange?: (indicator: string) => void;
	} = $props();
</script>

<div class="panel">
	<h2>Indicadores</h2>
	<ul>
		{#each indicators as ind}
			<li>
				<button
					class="indicator-btn"
					class:active={active === ind.id}
					class:disabled={!ind.available}
					disabled={!ind.available}
					onclick={() => ind.available && onChange?.(ind.id)}
				>
					<span class="dot" class:active={active === ind.id && ind.available}></span>
					{ind.label}
					{#if !ind.available}
						<span class="soon">pronto</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</div>

<style>
	.panel {
		padding: 1rem;
		border-bottom: 1px solid var(--border);
	}

	h2 {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
	}

	ul { list-style: none; display: flex; flex-direction: column; gap: 0.25rem; }

	.indicator-btn {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: var(--text);
		padding: 0.45rem 0.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		text-align: left;
		transition: background 0.12s;
	}

	.indicator-btn:hover:not(.disabled) { background: var(--bg-3); }
	.indicator-btn.active { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
	.indicator-btn.disabled { opacity: 0.4; cursor: default; }

	.dot {
		width: 8px; height: 8px;
		border-radius: 50%;
		border: 1.5px solid var(--text-muted);
		flex-shrink: 0;
	}
	.dot.active { background: var(--accent); border-color: var(--accent); }

	.soon {
		margin-left: auto;
		font-size: 0.65rem;
		color: var(--text-muted);
		border: 1px solid var(--border);
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
	}
</style>
