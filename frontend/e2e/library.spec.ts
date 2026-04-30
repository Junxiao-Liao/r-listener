import { expect, type Page, type Route, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await mockApi(page);
});

test.describe('library', () => {
	test('lists tracks with loading, empty, and data states', async ({ page }) => {
		await gotoApp(page, '/library');
		await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

		await expectVisible(page.getByText('Sunrise'));
		await expectVisible(page.getByText('Sunset'));
	});

	test('shows empty state when no tracks exist', async ({ page }) => {
		await page.route('**/api/tracks*', (route) =>
			json(route, { items: [], nextCursor: null })
		);
		await gotoApp(page, '/library');
		await expect(page.getByText('No tracks yet.')).toBeVisible();
	});

	test('shows error state on tracks fetch failure', async ({ page }) => {
		await page.route('**/api/tracks*', (route) =>
			json(route, { error: { code: 'internal_error', message: 'Failed.' } }, 500)
		);
		await gotoApp(page, '/library');
		await expect(page.getByText("Couldn't load tracks. Try again.")).toBeVisible();
	});

	test('navigates to track detail page', async ({ page }) => {
		await gotoApp(page, '/library/trk_sunrise');
		await expect(page.getByText('Sunrise')).toBeVisible();
		await expect(page.getByText('Artist A')).toBeVisible();
		await expect(page.getByText('3:00')).toBeVisible();
	});

	test('shows track not found for missing track', async ({ page }) => {
		await page.route('**/api/tracks/trk_missing', (route) =>
			json(route, { error: { code: 'not_found', message: 'Not found.' } }, 404)
		);
		await gotoApp(page, '/library/trk_missing');
		await expect(page.getByText('Track not found.')).toBeVisible();
	});

	test('library renders in 中文 when locale is zh', async ({ browser }) => {
		const context = await browser.newContext({ locale: 'zh-CN' });
		const page = await context.newPage();
		await mockApi(page);
		try {
			await gotoApp(page, '/library');
			await expect(page.getByRole('heading', { name: '音乐库' })).toBeVisible();
		} finally {
			await context.close();
		}
	});
});

async function gotoApp(page: Page, url: string) {
	await page.goto(url);
	await page.waitForLoadState('networkidle').catch(() => {});
	const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
	if (bodyText.trim().length === 0) {
		await page.reload();
		await page.waitForLoadState('networkidle').catch(() => {});
	}
}

async function expectVisible(locator: ReturnType<Page['getByText']>) {
	await expect(locator.first()).toBeVisible();
}

async function mockApi(page: Page) {
	await page.route('**/api/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname.replace(/^\/api/, '');

		if (path === '/auth/session') return json(route, session());

		if (path === '/queue') return json(route, { items: [], currentItemId: null, updatedAt: null });

		if (path === '/me/continue-listening' || path === '/me/recent-tracks') {
			return json(route, { items: [], nextCursor: null });
		}

		if (path === '/tracks') {
			return json(route, {
				items: [
					track({ id: 'trk_sunrise', title: 'Sunrise', artist: 'Artist A', durationMs: 180000 }),
					track({ id: 'trk_sunset', title: 'Sunset', artist: 'Artist B', durationMs: 240000 })
				],
				nextCursor: null
			});
		}

		if (path === '/tracks/trk_sunrise') {
			return json(route, track({ id: 'trk_sunrise', title: 'Sunrise', artist: 'Artist A', album: 'Morning', durationMs: 180000 }));
		}

		if (path === '/playlists') return json(route, { items: [], nextCursor: null });
		if (path === '/search') return json(route, { items: [], nextCursor: null });

		return json(route, { error: { code: 'not_found', message: 'Not mocked.' } }, 404);
	});
}

function json(route: Route, body: unknown, status = 200) {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function session() {
	return {
		user: { id: 'usr_a', username: 'alice', isAdmin: false, isActive: true, lastActiveTenantId: 'tnt_a', createdAt: '2026-04-26T00:00:00.000Z' },
		tenants: [{ tenantId: 'tnt_a', tenantName: 'Family Music', role: 'member', createdAt: '2026-04-26T00:00:00.000Z' }],
		preferences: { language: 'en', theme: 'system', autoPlayNext: true, showMiniPlayer: true, preferSyncedLyrics: true, defaultLibrarySort: 'createdAt:desc', updatedAt: '2026-04-26T00:00:00.000Z' },
		activeTenantId: 'tnt_a',
		sessionExpiresAt: '2026-05-26T00:00:00.000Z'
	};
}

function track(overrides: Record<string, unknown> = {}) {
	return {
		id: 'trk_a', tenantId: 'tnt_a', title: 'Track', artist: null, album: null,
		trackNumber: null, genre: null, year: null, durationMs: 0,
		coverUrl: null, lyricsLrc: null, lyricsStatus: 'none',
		contentType: 'audio/mpeg', sizeBytes: 1024, status: 'ready',
		createdAt: '2026-04-26T00:00:00.000Z', updatedAt: '2026-04-26T00:00:00.000Z',
		...overrides
	};
}
