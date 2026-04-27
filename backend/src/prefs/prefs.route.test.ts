import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { createTestEnv } from '../test/test-env';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { PrefsService } from './prefs.service';
import type { PreferencesDto } from './prefs.type';
import { createPrefsRoute } from './prefs.route';

describe('prefs route', () => {
	it('patches a language-only preference update', async () => {
		const service = createPrefsService();
		const app = createFixtureApp(service);

		const res = await app.request(
			'/me/preferences',
			{
				method: 'PATCH',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ language: 'zh' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(service.updatePreferences).toHaveBeenCalledWith(sessionFixture().user.id, {
			language: 'zh'
		});
		expect(await res.json()).toMatchObject({ language: 'zh', theme: 'system' });
	});

	it('patches a theme-only preference update', async () => {
		const service = createPrefsService();
		const app = createFixtureApp(service);

		const res = await app.request(
			'/me/preferences',
			{
				method: 'PATCH',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ theme: 'dark' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(service.updatePreferences).toHaveBeenCalledWith(sessionFixture().user.id, {
			theme: 'dark'
		});
		expect(await res.json()).toMatchObject({ language: 'en', theme: 'dark' });
	});

	it('patches combined visual preference updates', async () => {
		const service = createPrefsService();
		const app = createFixtureApp(service);

		const res = await app.request(
			'/me/preferences',
			{
				method: 'PATCH',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ language: 'zh', theme: 'dark' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(service.updatePreferences).toHaveBeenCalledWith(sessionFixture().user.id, {
			language: 'zh',
			theme: 'dark'
		});
		expect(await res.json()).toMatchObject({ language: 'zh', theme: 'dark' });
	});
});

function createFixtureApp(service: PrefsService) {
	const app = new Hono<BackendEnv>();
	const middlewareService: MiddlewareService = {
		validateSession: vi.fn(async ({ token }) =>
			token === 'valid' ? { ...sessionFixture(), refreshedSessionExpiresAt: null } : null
		),
		resolveTenantAccess: vi.fn(),
		checkAuthRateLimit: vi.fn(async () => ({ allowed: true }))
	};

	app.use('*', async (c, next) => {
		c.set('db', {} as never);
		c.set('middlewareService', middlewareService);
		await next();
	});
	app.route('/', createPrefsRoute({ createPrefsService: () => service }));
	return app;
}

function createPrefsService(): PrefsService {
	return {
		getPreferences: vi.fn(async () => prefsFixture()),
		updatePreferences: vi.fn(async (_userId, patch) => prefsFixture(patch))
	};
}

function sessionFixture(): SessionContext {
	return {
		user: {
			id: 'usr_018f0000-0000-7000-8000-000000000000' as SessionContext['user']['id'],
			username: 'user',
			isAdmin: false,
			isActive: true,
			lastActiveTenantId: null,
			createdAt: '2026-04-26T00:00:00.000Z' as SessionContext['user']['createdAt']
		},
		sessionTokenHash: 'hash',
		activeTenantId: null,
		role: null,
		sessionExpiresAt: '2026-05-26T00:00:00.000Z'
	};
}

function prefsFixture(overrides: Partial<PreferencesDto> = {}): PreferencesDto {
	return {
		language: 'en',
		theme: 'system',
		autoPlayNext: true,
		showMiniPlayer: true,
		preferSyncedLyrics: true,
		defaultLibrarySort: 'createdAt:desc',
		updatedAt: '2026-04-26T00:00:00.000Z' as PreferencesDto['updatedAt'],
		...overrides
	};
}
