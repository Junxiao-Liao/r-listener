import { json } from '@sveltejs/kit';
import { createApiClient } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, fetch, platform }) => {
	const backendUrl = platform?.env.BACKEND_URL;
	if (!backendUrl) {
		return json({ ok: false, error: 'BACKEND_URL not configured' }, { status: 500 });
	}
	const api = createApiClient({
		backendUrl,
		sessionToken: cookies.get(SESSION_COOKIE),
		fetch
	});
	return json(await api.request('/health'));
};
