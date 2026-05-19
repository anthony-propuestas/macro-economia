import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform }) => {
	const cookie = request.headers.get('Cookie') ?? '';
	const sessionId = cookie.match(/session_id=([^;]+)/)?.[1];

	if (sessionId && platform?.env?.SESSIONS) {
		await platform.env.SESSIONS.delete(sessionId);
	}

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/login',
			'Set-Cookie': 'session_id=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
		},
	});
};
