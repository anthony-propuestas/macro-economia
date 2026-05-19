<script lang="ts">
	import '../app.css';

	let { children, data } = $props();
</script>

<svelte:head>
	<title>MacroObserver</title>
	<meta name="description" content="Observatorio macroeconómico mundial" />
</svelte:head>

{#if data.user}
	<nav class="main-nav">
		<span class="brand">MacroObserver</span>
		<div class="user-info">
			{#if data.user.picture}
				<img class="avatar" src={data.user.picture} alt={data.user.name} referrerpolicy="no-referrer" />
			{/if}
			<span>{data.user.name}</span>
			<a class="logout" href="/api/auth/logout">Salir</a>
		</div>
	</nav>
{/if}

{@render children()}
