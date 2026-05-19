import type { EventContext, KVNamespace } from '@cloudflare/workers-types';

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
	const { request, env } = context;
	const cookie = request.headers.get('Cookie') ?? '';
	const sessionId = cookie.match(/session_id=([^;]+)/)?.[1];

	if (sessionId) await env.SESSIONS.delete(sessionId);

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/login',
			'Set-Cookie': 'session_id=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
		},
	});
}

interface Env {
	SESSIONS: KVNamespace;
}
