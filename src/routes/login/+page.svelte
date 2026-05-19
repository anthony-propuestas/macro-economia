<script lang="ts">
	// Login page — no data required
</script>

<div class="login-page">
	<div class="card">
		<h1>MacroObserver</h1>
		<p>Observatorio macroeconómico mundial interactivo</p>
		<a href="/api/auth/google" class="btn-google">
			<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
				<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
				<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
				<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
				<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
			</svg>
			Continuar con Google
		</a>
	</div>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
	}

	.card {
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 2.5rem 2rem;
		text-align: center;
		width: 320px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	h1 {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--accent);
	}

	p {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
	}

	.btn-google {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		background: #fff;
		color: #333;
		border-radius: 6px;
		padding: 0.65rem 1rem;
		font-weight: 500;
		font-size: 0.9rem;
		margin-top: 0.5rem;
		transition: background 0.15s;
	}

	.btn-google:hover {
		background: #f5f5f5;
		color: #111;
	}
</style>
