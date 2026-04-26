// Session cookie helpers. The browser-facing cookie is owned exclusively
// by the SvelteKit BFF; the backend never sets it directly. Backend session
// rows expire on their own clock; the BFF mirrors that expiry to the cookie
// so the browser stops sending it after backend expiry.

import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'session';

// Subset of Kit's Cookies surface we use. Loose enough to mock in tests
// without depending on Kit internals, but compatible with the real type.
export type CookieJar = Pick<Cookies, 'set' | 'delete'>;

const baseOpts = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	path: '/'
};

export function setSessionCookie(cookies: CookieJar, token: string, expiresAtIso: string): void {
	cookies.set(SESSION_COOKIE, token, {
		...baseOpts,
		expires: new Date(expiresAtIso)
	});
}

export function clearSessionCookie(cookies: CookieJar): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export const SESSION_EXPIRES_HEADER = 'X-Session-Expires-At';

// Backend stamps X-Session-Expires-At only when it actually rolled the
// session expiry forward. When the header is absent, the cookie's expiry
// is still authoritative and we leave it alone.
export function rollSessionCookie(
	cookies: CookieJar,
	responseHeaders: Headers,
	currentToken: string | null | undefined
): void {
	const next = responseHeaders.get(SESSION_EXPIRES_HEADER);
	if (!next || !currentToken) return;
	setSessionCookie(cookies, currentToken, next);
}
