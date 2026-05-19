import type { EventContext, KVNamespace } from '@cloudflare/workers-types';

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
	const { request, env } = context;
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const cookie = request.headers.get('cookie') ?? '';
	const cookieState = cookie.match(/oauth_state=([^;]+)/)?.[1];

	if (!code) {
		return new Response('Missing OAuth code', { status: 400 });
	}
	if (!state || !cookieState || state !== cookieState) {
		return new Response('Invalid OAuth state', { status: 400 });
	}

	// Exchange code for tokens
	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			redirect_uri: `${url.origin}/api/auth/google/callback`,
			grant_type: 'authorization_code',
		}),
	});

	const tokens = await tokenRes.json<{ access_token: string; error?: string }>();
	if (tokens.error || !tokens.access_token) {
		return new Response('OAuth token exchange failed', { status: 400 });
	}

	// Fetch user info from Google
	const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
		headers: { Authorization: `Bearer ${tokens.access_token}` },
	});
	const user = await userRes.json<{ email: string; name: string; picture: string }>();

	// Store session in KV (7 days) — no access_token, it expires in 1h anyway
	const sessionId = crypto.randomUUID();
	await env.SESSIONS.put(
		sessionId,
		JSON.stringify({ user, created_at: Date.now() }),
		{ expirationTtl: 604800 }
	);

	const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	const secureFlag = isLocal ? '' : '; Secure';

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/',
			'Set-Cookie': `session_id=${sessionId}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=604800`,
		},
	});
}

interface Env {
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	SESSIONS: KVNamespace;
}
