import type { Handle } from '@sveltejs/kit';
import { parseAcceptLanguage } from '$shared/i18n/locale';
import { getTextDirection } from '$shared/paraglide/runtime';
import { paraglideMiddleware } from '$shared/paraglide/server';
import {
	registerRequestLocaleStrategy,
	setRequestLocale
} from '$shared/i18n/request-locale';
import { fetchAppSession } from '$shared/server/require-session';

registerRequestLocaleStrategy();

function shouldResolveSessionLocale(request: Request): boolean {
	const method = request.method.toUpperCase();
	if (method !== 'GET' && method !== 'HEAD') return false;

	const pathname = new URL(request.url).pathname;
	if (pathname.startsWith('/_app/') || pathname.startsWith('/api/')) return false;
	if (/\.[A-Za-z0-9]+$/.test(pathname)) return false;

	return true;
}


const handleParaglide: Handle = async ({ event, resolve }) => {
	if (shouldResolveSessionLocale(event.request)) {
		const session = await fetchAppSession(event);
		const locale =
			session?.preferences.language ??
			parseAcceptLanguage(event.request.headers.get('accept-language')) ??
			'en';
		if (session) event.locals.session = session;
		setRequestLocale(event.request, locale);
	}

	return paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace('%paraglide.lang%', locale).replace('%paraglide.dir%', getTextDirection(locale))
		});
	});
};

export const handle: Handle = handleParaglide;
