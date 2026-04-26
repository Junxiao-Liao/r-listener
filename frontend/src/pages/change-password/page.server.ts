import { redirect, type Action } from '@sveltejs/kit';
import { authApi } from '$shared/api/auth';
import { ApiError, createApiClient } from '$shared/server/api';
import { getBackendUrl, getFrontendOrigin } from '$shared/server/origin';
import { clearSessionCookie, SESSION_COOKIE } from '$shared/server/session';
import { asErrorStatus, fail, message, superValidate, zod } from '$shared/forms/superforms';
import type { FormMessage } from '$shared/forms/superforms';
import { changePasswordSchema, defaultChangePasswordForm } from './change-password.form';

export async function load() {
	const form = await superValidate(defaultChangePasswordForm, zod(changePasswordSchema));
	return { form };
}

const changePassword: Action = async ({ request, cookies, fetch, platform }) => {
	const form = await superValidate(request, zod(changePasswordSchema));
	if (!form.valid) return fail(400, { form });
	const token = cookies.get(SESSION_COOKIE);
	if (!token) throw redirect(303, '/signin');
	const api = createApiClient({
		backendUrl: getBackendUrl(platform),
		frontendOrigin: getFrontendOrigin(platform),
		sessionToken: token,
		fetch
	});
	try {
		await authApi.changePassword(api, {
			currentPassword: form.data.currentPassword,
			newPassword: form.data.newPassword
		});
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
	clearSessionCookie(cookies);
	cookies.set('signin_flash', 'changed', { path: '/', maxAge: 60 });
	throw redirect(303, '/signin');
};

export const actions = { default: changePassword };
