import { redirect } from '@sveltejs/kit';
import { loadAppSession } from '$shared/server/require-session';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const session = event.locals.session ?? (await loadAppSession(event));

	const path = event.url.pathname;
	const onPicker = path === '/tenants';
	if (!session.activeTenantId && !onPicker) {
		throw redirect(303, '/tenants');
	}

	return { session };
};
