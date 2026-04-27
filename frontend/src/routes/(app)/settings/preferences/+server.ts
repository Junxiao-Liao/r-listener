import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { prefsApi } from '$shared/api/prefs';
import { ApiError, createApiClient } from '$shared/server/api';
import { getBackendUrl, getFrontendOrigin } from '$shared/server/origin';
import { SESSION_COOKIE } from '$shared/server/session';
import { applyThemeCookie } from '$shared/theme/theme';
import type { ApiErrorBody } from '$shared/types/dto';
import { languageSchema, themeSchema } from '$pages/settings/settings.form';

const visualPreferencePatchSchema = z.union([
	z.object({ theme: themeSchema }).strict(),
	z.object({ language: languageSchema }).strict()
]);

function makeApi(event: Pick<RequestEvent, 'cookies' | 'fetch' | 'platform'>) {
	return createApiClient({
		backendUrl: getBackendUrl(event.platform),
		frontendOrigin: getFrontendOrigin(event.platform),
		sessionToken: event.cookies.get(SESSION_COOKIE),
		fetch: event.fetch
	});
}

function apiErrorResponse(error: ApiError) {
	return json(
		{
			error: {
				code: error.code,
				message: error.message,
				...(error.fields ? { fields: error.fields } : {}),
				...(error.details ? { details: error.details } : {})
			}
		} satisfies ApiErrorBody,
		{ status: error.status }
	);
}

export async function PATCH(event: RequestEvent) {
	const body = await event.request.json().catch(() => null);
	const patch = visualPreferencePatchSchema.safeParse(body);
	if (!patch.success) {
		return json(
			{
				error: {
					code: 'validation_failed',
					message: 'Invalid input.'
				}
			} satisfies ApiErrorBody,
			{ status: 400 }
		);
	}

	const api = makeApi(event);
	try {
		const preferences = await prefsApi.patch(api, patch.data);
		if ('theme' in patch.data) applyThemeCookie(event.cookies, patch.data.theme);
		return json(preferences);
	} catch (error) {
		if (error instanceof ApiError) return apiErrorResponse(error);
		throw error;
	}
}
