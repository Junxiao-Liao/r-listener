import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '$shared/paraglide/runtime';

export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname;
