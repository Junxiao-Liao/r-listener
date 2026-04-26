import { redirect, error as svelteError, type RequestEvent } from '@sveltejs/kit';
import { authApi } from '$shared/api/auth';
import { applyLocaleCookie } from '$shared/i18n/locale';
import { ApiError, createApiClient } from './api';
import { getBackendUrl, getFrontendOrigin } from './origin';
import { clearSessionCookie, rollSessionCookie, SESSION_COOKIE } from './session';
import type { CurrentSessionDto } from '$shared/types/dto';

type Event = Pick<RequestEvent, 'cookies' | 'fetch' | 'platform'>;

export type AppSession = CurrentSessionDto;

// Loads the active session for any authenticated route. Performs:
// - 401 → redirect to /signin (with the local cookie cleared).
// - rolling session cookie refresh based on X-Session-Expires-At.
// - paraglide locale cookie sync to user preferences.
export async function loadAppSession(event: Event): Promise<AppSession> {
	const token = event.cookies.get(SESSION_COOKIE);
	if (!token) {
		throw redirect(303, '/signin');
	}
	const api = createApiClient({
		backendUrl: getBackendUrl(event.platform),
		frontendOrigin: getFrontendOrigin(event.platform),
		sessionToken: token,
		fetch: event.fetch
	});
	let session: CurrentSessionDto;
	try {
		session = await authApi.getSession(api, (res) => rollSessionCookie(event.cookies, res.headers, token));
	} catch (err) {
		if (err instanceof ApiError) {
			if (err.status === 401) {
				clearSessionCookie(event.cookies);
				throw redirect(303, '/signin');
			}
			throw svelteError(err.status, err.message);
		}
		throw err;
	}
	applyLocaleCookie(event.cookies, session.preferences.language);
	return session;
}
