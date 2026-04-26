import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$shared/paraglide/runtime';
import { paraglideMiddleware } from '$shared/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) => paraglideMiddleware(event.request, ({ request, locale }) => {
	event.request = request;

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale).replace('%paraglide.dir%', getTextDirection(locale))
	});
});

export const handle: Handle = handleParaglide;
