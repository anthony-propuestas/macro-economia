import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform, url }) => {
	const state = crypto.randomUUID();
	const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	const secureFlag = isLocal ? '' : '; Secure';

	const params = new URLSearchParams({
		client_id: platform!.env.GOOGLE_CLIENT_ID,
		redirect_uri: `${url.origin}/api/auth/google/callback`,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'offline',
		state,
	});

	return new Response(null, {
		status: 302,
		headers: {
			Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
			'Set-Cookie': `oauth_state=${state}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=600`,
		},
	});
};
