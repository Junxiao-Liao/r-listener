import {
	redirect,
	type Action,
	type RequestEvent,
	type ServerLoadEvent
} from '@sveltejs/kit';
import { authApi } from '$shared/api/auth';
import { prefsApi } from '$shared/api/prefs';
import { applyLocaleCookie } from '$shared/i18n/locale';
import { ApiError, createApiClient } from '$shared/server/api';
import { getBackendUrl, getFrontendOrigin } from '$shared/server/origin';
import { clearSessionCookie, SESSION_COOKIE } from '$shared/server/session';
import { asErrorStatus, fail, message, superValidate, zod } from '$shared/forms/superforms';
import type { FormMessage } from '$shared/forms/superforms';
import type { CurrentSessionDto } from '$shared/types/dto';
import {
	preferencesSchema,
	type PreferencesForm
} from './settings.form';

type ParentData = { session: CurrentSessionDto };

export async function load({ parent }: ServerLoadEvent<never, ParentData>) {
	const { session } = await parent();
	const initial: PreferencesForm = {
		language: session.preferences.language,
		autoPlayNext: session.preferences.autoPlayNext,
		showMiniPlayer: session.preferences.showMiniPlayer,
		preferSyncedLyrics: session.preferences.preferSyncedLyrics,
		defaultLibrarySort: session.preferences.defaultLibrarySort
	};
	const form = await superValidate(initial, zod(preferencesSchema));
	return { form, session };
}

function makeApi(event: Pick<RequestEvent, 'cookies' | 'fetch' | 'platform'>) {
	return createApiClient({
		backendUrl: getBackendUrl(event.platform),
		frontendOrigin: getFrontendOrigin(event.platform),
		sessionToken: event.cookies.get(SESSION_COOKIE),
		fetch: event.fetch
	});
}

const savePreferences: Action = async (event) => {
	const form = await superValidate(event.request, zod(preferencesSchema));
	if (!form.valid) return fail(400, { form });
	const api = makeApi(event);
	try {
		await prefsApi.patch(api, form.data);
		if (form.data.language) applyLocaleCookie(event.cookies, form.data.language);
		return message<FormMessage>(form, { type: 'success' });
	} catch (err) {
		if (err instanceof ApiError) {
			return message<FormMessage>(
				form,
				{ type: 'error', code: err.code },
				{ status: asErrorStatus(err.status) }
			);
		}
		throw err;
	}
};

const signout: Action = async (event) => {
	const api = makeApi(event);
	try {
		await authApi.signout(api);
	} catch (err) {
		// even if the backend returned 4xx (e.g. session already gone),
		// always clear the local cookie. Re-throw on 5xx so the action surfaces.
		if (!(err instanceof ApiError) || err.status >= 500) throw err;
	}
	clearSessionCookie(event.cookies);
	throw redirect(303, '/signin');
};

const switchWorkspace: Action = async () => {
	throw redirect(303, '/tenants');
};

export const actions = { savePreferences, signout, switchWorkspace };
