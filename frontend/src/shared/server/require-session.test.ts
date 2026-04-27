import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const mocks = vi.hoisted(() => {
	const signinRedirect = { __kind: 'redirect' };
	class TestApiError extends Error {
		constructor(
			public readonly status: number,
			public readonly code: string,
			message: string
		) {
			super(message);
		}
	}

	return {
		signinRedirect,
		redirectMock: vi.fn(() => signinRedirect),
		errorMock: vi.fn((status: number, message: string) => ({ status, message })),
		getSessionMock: vi.fn(),
		applyThemeCookieMock: vi.fn(),
		clearSessionCookieMock: vi.fn(),
		rollSessionCookieMock: vi.fn(),
		createApiClientMock: vi.fn(() => ({ request: vi.fn() })),
		TestApiError
	};
});

vi.mock('@sveltejs/kit', () => ({
	redirect: mocks.redirectMock,
	error: mocks.errorMock
}));

vi.mock('$shared/api/auth', () => ({
	authApi: {
		getSession: (...args: unknown[]) => mocks.getSessionMock(...args)
	}
}));

vi.mock('$shared/theme/theme', () => ({
	applyThemeCookie: (...args: unknown[]) => mocks.applyThemeCookieMock(...args)
}));

vi.mock('./session', () => ({
	SESSION_COOKIE: 'session',
	clearSessionCookie: (...args: unknown[]) => mocks.clearSessionCookieMock(...args),
	rollSessionCookie: (...args: unknown[]) => mocks.rollSessionCookieMock(...args)
}));

vi.mock('./api', () => ({
	createApiClient: () => mocks.createApiClientMock(),
	ApiError: mocks.TestApiError
}));

vi.mock('./origin', () => ({
	getBackendUrl: () => 'http://backend.test',
	getFrontendOrigin: () => 'http://app.test'
}));

import { fetchAppSession, loadAppSession } from './require-session';

type SessionEvent = Parameters<typeof fetchAppSession>[0] & { locals: App.Locals };

function mockEvent(sessionToken: string | null): SessionEvent {
	const cookieReads = vi.fn((name: string) =>
		name === 'session' ? (sessionToken ?? undefined) : undefined
	);
	const cookies: Pick<Cookies, 'get' | 'set' | 'delete' | 'getAll' | 'serialize'> = {
		get: cookieReads,
		set: vi.fn(),
		delete: vi.fn(),
		getAll: vi.fn(() => []),
		serialize: vi.fn(() => '')
	};
	return {
		cookies,
		fetch: vi.fn() as unknown as typeof fetch,
		platform: undefined,
		locals: {} as App.Locals
	} as unknown as SessionEvent;
}

const sessionFixture = {
	user: {
		id: 'u1',
		username: 'alice',
		isAdmin: false,
		isActive: true,
		lastActiveTenantId: 't1',
		createdAt: '2026-01-01T00:00:00.000Z'
	},
	tenants: [
		{
			tenantId: 't1',
			tenantName: 'Main',
			role: 'owner' as const,
			createdAt: '2026-01-01T00:00:00.000Z'
		}
	],
	preferences: {
		language: 'zh' as const,
		theme: 'dark' as const,
		autoPlayNext: true,
		showMiniPlayer: true,
		preferSyncedLyrics: true,
		defaultLibrarySort: 'createdAt:desc' as const,
		updatedAt: '2026-01-01T00:00:00.000Z'
	},
	activeTenantId: 't1',
	sessionExpiresAt: '2026-01-02T00:00:00.000Z'
};

describe('fetchAppSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns null when no session cookie is present', async () => {
		const event = mockEvent(null);

		await expect(fetchAppSession(event)).resolves.toBeNull();
		expect(mocks.getSessionMock).not.toHaveBeenCalled();
	});

	it('loads and returns session, rolling cookie and syncing theme', async () => {
		mocks.getSessionMock.mockImplementationOnce(async (_api: unknown, onResponse?: (res: Response) => void) => {
			onResponse?.(new Response(null, { headers: { 'X-Session-Expires-At': '2030-01-01T00:00:00.000Z' } }));
			return sessionFixture;
		});
		const event = mockEvent('token-1');

		const result = await fetchAppSession(event);

		expect(mocks.createApiClientMock).toHaveBeenCalledOnce();
		expect(result).toEqual(sessionFixture);
		expect(mocks.rollSessionCookieMock).toHaveBeenCalledOnce();
		expect(mocks.applyThemeCookieMock).toHaveBeenCalledWith(event.cookies, 'dark');
	});

	it('clears cookie and returns null on 401 response', async () => {
		mocks.getSessionMock.mockRejectedValueOnce(
			new mocks.TestApiError(401, 'unauthenticated', 'no session')
		);
		const event = mockEvent('token-1');

		await expect(fetchAppSession(event)).resolves.toBeNull();
		expect(mocks.clearSessionCookieMock).toHaveBeenCalledWith(event.cookies);
	});

	it('converts other ApiError responses into svelte errors', async () => {
		mocks.getSessionMock.mockRejectedValueOnce(
			new mocks.TestApiError(500, 'internal_error', 'boom')
		);
		const event = mockEvent('token-1');

		await expect(fetchAppSession(event)).rejects.toMatchObject({ status: 500, message: 'boom' });
		expect(mocks.errorMock).toHaveBeenCalledWith(500, 'boom');
	});
});

describe('loadAppSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('reuses event.locals.session when already loaded', async () => {
		const event = mockEvent('token-1');
		event.locals.session = sessionFixture;

		const result = await loadAppSession(event);

		expect(result).toEqual(sessionFixture);
		expect(mocks.getSessionMock).not.toHaveBeenCalled();
	});

	it('stores loaded session in locals', async () => {
		mocks.getSessionMock.mockResolvedValueOnce(sessionFixture);
		const event = mockEvent('token-1');

		const result = await loadAppSession(event);

		expect(result).toEqual(sessionFixture);
		expect(event.locals.session).toEqual(sessionFixture);
	});

	it('redirects to signin when no valid session exists', async () => {
		const event = mockEvent(null);

		await expect(loadAppSession(event)).rejects.toBe(mocks.signinRedirect);
		expect(mocks.redirectMock).toHaveBeenCalledWith(303, '/signin');
	});
});
