import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import type { BackendEnv } from '../app.type';
import type { Iso8601 } from '../shared/shared.type';
import { SESSION_COOKIE } from './session';

export function setSessionCookie(
	c: Context<BackendEnv>,
	token: string,
	expiresAtIso: Iso8601 | string
): void {
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		secure: true,
		sameSite: 'Lax',
		path: '/',
		expires: new Date(expiresAtIso)
	});
}

export function clearSessionCookie(c: Context<BackendEnv>): void {
	deleteCookie(c, SESSION_COOKIE, { path: '/' });
}
