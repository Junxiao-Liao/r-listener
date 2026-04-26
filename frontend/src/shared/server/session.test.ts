import { describe, expect, it, vi } from 'vitest';
import {
	clearSessionCookie,
	rollSessionCookie,
	SESSION_COOKIE,
	setSessionCookie
} from './session';

type CookieCall = { name: string; value: string; opts: Record<string, unknown> };

function mockCookies() {
	const calls: CookieCall[] = [];
	const api = {
		set: (name: string, value: string, opts: Record<string, unknown>): void => {
			calls.push({ name, value, opts });
		},
		delete: (name: string, opts: Record<string, unknown>): void => {
			calls.push({ name, value: '', opts });
		}
	};
	return { calls, api: api as never };
}

describe('setSessionCookie', () => {
	it('writes the session cookie with HttpOnly/Secure/SameSite=Lax/Path=/ and the given expiry', () => {
		const { calls, api } = mockCookies();
		setSessionCookie(api, 'tok-123', '2030-01-01T00:00:00.000Z');
		expect(calls).toEqual([
			{
				name: SESSION_COOKIE,
				value: 'tok-123',
				opts: {
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					path: '/',
					expires: new Date('2030-01-01T00:00:00.000Z')
				}
			}
		]);
	});
});

describe('clearSessionCookie', () => {
	it('deletes the cookie at path /', () => {
		const { calls, api } = mockCookies();
		clearSessionCookie(api);
		expect(calls).toEqual([{ name: SESSION_COOKIE, value: '', opts: { path: '/' } }]);
	});
});

describe('rollSessionCookie', () => {
	it('no-ops when X-Session-Expires-At is absent', () => {
		const { calls, api } = mockCookies();
		const headers = new Headers();
		rollSessionCookie(api, headers, 'tok');
		expect(calls).toEqual([]);
	});

	it('refreshes the cookie when the header is present', () => {
		const { calls, api } = mockCookies();
		const headers = new Headers({ 'X-Session-Expires-At': '2030-02-02T00:00:00.000Z' });
		rollSessionCookie(api, headers, 'tok-abc');
		expect(calls).toHaveLength(1);
		expect(calls[0].opts.expires).toEqual(new Date('2030-02-02T00:00:00.000Z'));
		expect(calls[0].value).toBe('tok-abc');
	});

	it('does nothing when the token is missing (cannot reissue without it)', () => {
		const { calls, api } = mockCookies();
		const headers = new Headers({ 'X-Session-Expires-At': '2030-02-02T00:00:00.000Z' });
		rollSessionCookie(api, headers, null);
		expect(calls).toEqual([]);
	});
});

describe('integration with vi.fn cookies', () => {
	it('forwards the kit Cookies API shape', () => {
		const set = vi.fn();
		const del = vi.fn();
		setSessionCookie({ set, delete: del } as never, 'tok', '2030-01-01T00:00:00.000Z');
		expect(set).toHaveBeenCalledOnce();
	});
});
