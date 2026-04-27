import { redirect, error as svelteError, type RequestEvent } from '@sveltejs/kit';
import { authApi } from '$shared/api/auth';
import { applyThemeCookie } from '$shared/theme/theme';
import { ApiError, createApiClient } from './api';
import { getBackendUrl, getFrontendOrigin } from './origin';
import { clearSessionCookie, rollSessionCookie, SESSION_COOKIE } from './session';
import type { CurrentSessionDto } from '$shared/types/dto';

type BaseEvent = Pick<RequestEvent, 'cookies' | 'fetch' | 'platform'>;
type Event = BaseEvent & Pick<RequestEvent, 'locals'>;

export type AppSession = CurrentSessionDto;

// Loads the active session for any authenticated route. Performs:
// - 401 → redirect to /signin (with the local cookie cleared).
// - rolling session cookie refresh based on X-Session-Expires-At.
// - theme cookie sync to user preferences for first paint.
export async function fetchAppSession(event: BaseEvent): Promise<AppSession | null> {
	const token = event.cookies.get(SESSION_COOKIE);
	if (!token) {
		return null;
	}
	const api = createApiClient({
		backendUrl: getBackendUrl(event.platform),
		frontendOrigin: getFrontendOrigin(event.platform),
		sessionToken: token,
		fetch: event.fetch
	});
	try {
		const session = await authApi.getSession(api, (res) =>
			rollSessionCookie(event.cookies, res.headers, token)
		);
		applyThemeCookie(event.cookies, session.preferences.theme);
		return session;
	} catch (err) {
		if (err instanceof ApiError) {
			if (err.status === 401) {
				clearSessionCookie(event.cookies);
				return null;
			}
			throw svelteError(err.status, err.message);
		}
		throw err;
	}
}

export async function loadAppSession(event: Event): Promise<AppSession> {
	if (event.locals.session) return event.locals.session;

	const session = await fetchAppSession(event);
	if (!session) {
		throw redirect(303, '/signin');
	}

	event.locals.session = session;
	return session;
}
