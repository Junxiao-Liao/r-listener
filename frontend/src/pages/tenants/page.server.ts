import {
	redirect,
	type Action,
	type ServerLoadEvent
} from '@sveltejs/kit';
import { adminApi } from '$shared/api/admin';
import { authApi } from '$shared/api/auth';
import { ApiError, createApiClient } from '$shared/server/api';
import { getBackendUrl, getFrontendOrigin } from '$shared/server/origin';
import { SESSION_COOKIE } from '$shared/server/session';
import { asErrorStatus, fail, message, superValidate, zod } from '$shared/forms/superforms';
import type { FormMessage } from '$shared/forms/superforms';
import type { CurrentSessionDto } from '$shared/types/dto';
import { defaultSwitchTenantForm, switchTenantSchema } from './tenants.form';

type ParentData = { session: CurrentSessionDto };

export async function load({ parent, cookies, fetch, platform }: ServerLoadEvent<never, ParentData>) {
	const { session } = await parent();
	const form = await superValidate(defaultSwitchTenantForm, zod(switchTenantSchema));
	const api = createApiClient({
		backendUrl: getBackendUrl(platform),
		frontendOrigin: getFrontendOrigin(platform),
		sessionToken: cookies.get(SESSION_COOKIE),
		fetch
	});
	const adminTenants =
		session.user.isAdmin && session.tenants.length === 0
			? (await adminApi.listTenants(api)).tenants
			: [];
	return {
		form,
		memberships: session.tenants,
		adminTenants,
		lastActiveTenantId: session.user.lastActiveTenantId,
		isAdminWithNoMemberships: session.user.isAdmin && session.tenants.length === 0
	};
}

const switchTenant: Action = async ({ request, cookies, fetch, platform }) => {
	const form = await superValidate(request, zod(switchTenantSchema));
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
		await authApi.switchTenant(api, form.data.tenantId);
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
	throw redirect(303, '/');
};

export const actions = { default: switchTenant };
