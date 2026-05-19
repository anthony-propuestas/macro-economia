import type { EventContext, KVNamespace } from '@cloudflare/workers-types';

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
	const { request, env } = context;
	const cookie = request.headers.get('Cookie') ?? '';
	const sessionId = cookie.match(/session_id=([^;]+)/)?.[1];

	if (!sessionId) return Response.json({ authenticated: false }, { status: 401 });

	const raw = await env.SESSIONS.get(sessionId);
	if (!raw) return Response.json({ authenticated: false }, { status: 401 });

	const session = JSON.parse(raw);
	return Response.json({ authenticated: true, user: session.user });
}

interface Env {
	SESSIONS: KVNamespace;
}
