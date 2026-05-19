import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform, url }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const cookie = request.headers.get('cookie') ?? '';
	const cookieState = cookie.match(/oauth_state=([^;]+)/)?.[1];

	if (!code) return new Response('Missing OAuth code', { status: 400 });
	if (!state || !cookieState || state !== cookieState) return new Response('Invalid OAuth state', { status: 400 });

	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: platform!.env.GOOGLE_CLIENT_ID,
			client_secret: platform!.env.GOOGLE_CLIENT_SECRET,
			redirect_uri: `${url.origin}/api/auth/google/callback`,
			grant_type: 'authorization_code',
		}),
	});

	const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
	if (tokens.error || !tokens.access_token) return new Response('OAuth token exchange failed', { status: 400 });

	const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
		headers: { Authorization: `Bearer ${tokens.access_token}` },
	});
	const user = (await userRes.json()) as { email: string; name: string; picture: string };

	const sessionId = crypto.randomUUID();
	await platform!.env.SESSIONS.put(
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
};
