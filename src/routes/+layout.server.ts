import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request, url, platform }) => {
	if (url.pathname === '/login') return {};

	// Skip auth in dev when platform bindings are unavailable
	if (!platform?.env?.SESSIONS) {
		return { user: { email: 'dev@local', name: 'Dev User', picture: '' } };
	}

	const cookie = request.headers.get('cookie') ?? '';
	const sessionId = cookie.match(/session_id=([^;]+)/)?.[1];

	if (!sessionId) redirect(302, '/login');

	const raw = await platform.env.SESSIONS.get(sessionId!);
	if (!raw) redirect(302, '/login');

	const session = JSON.parse(raw);
	if (!session?.user?.email || typeof session.user.name !== 'string') redirect(302, '/login');
	return { user: session.user };
};
