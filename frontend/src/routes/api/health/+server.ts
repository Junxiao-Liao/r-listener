import { json } from '@sveltejs/kit';
import { createApiClient } from '$shared/server/api';
import { getBackendUrl, getFrontendOrigin } from '$shared/server/origin';
import { SESSION_COOKIE } from '$shared/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, fetch, platform }) => {
	const api = createApiClient({
		backendUrl: getBackendUrl(platform),
		frontendOrigin: getFrontendOrigin(platform),
		sessionToken: cookies.get(SESSION_COOKIE),
		fetch
	});
	return json(await api.request('/health'));
};
