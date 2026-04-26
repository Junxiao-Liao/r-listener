import { fail, redirect, type Action, type ServerLoadEvent } from '@sveltejs/kit';
import { authApi } from '$shared/api/auth';
import { ApiError, createApiClient } from '$shared/server/api';
import { getBackendUrl, getFrontendOrigin } from '$shared/server/origin';
import { setSessionCookie } from '$shared/server/session';
import { asErrorStatus, message, superValidate, zod } from '$shared/forms/superforms';
import type { FormMessage } from '$shared/forms/superforms';
import { defaultSigninForm, signinSchema } from './signin.form';

export async function load({ cookies }: ServerLoadEvent) {
	const form = await superValidate(defaultSigninForm, zod(signinSchema));
	const justChanged = cookies.get('signin_flash') === 'changed';
	if (justChanged) cookies.delete('signin_flash', { path: '/' });
	return { form, justChanged };
}

const signin: Action = async ({ request, cookies, fetch, platform }) => {
	const form = await superValidate(request, zod(signinSchema));
	if (!form.valid) return fail(400, { form });

	const api = createApiClient({
		backendUrl: getBackendUrl(platform),
		frontendOrigin: getFrontendOrigin(platform),
		fetch
	});
	try {
		const result = await authApi.signin(api, form.data);
		setSessionCookie(cookies, result.sessionToken, result.sessionExpiresAt);
		throw redirect(303, result.activeTenantId ? '/' : '/tenants');
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

export const actions = { default: signin };
