import { expect, type Page, type Route, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await mockApi(page);
});

test.describe('playlists', () => {
	test('lists playlists with empty state', async ({ page }) => {
		await gotoApp(page, '/playlists');
		await expect(page.getByRole('heading', { name: 'Playlists' })).toBeVisible();
		await expect(page.getByText('No playlists yet')).toBeVisible();
	});

	test('lists playlists with data', async ({ page }) => {
		await page.route('**/api/playlists*', (route) =>
			json(route, {
				items: [
					playlist({ id: 'pl_1', name: 'Morning Mix', trackCount: 5, totalDurationMs: 1200000 }),
					playlist({ id: 'pl_2', name: 'Evening Chill', trackCount: 3, totalDurationMs: 600000 })
				],
				nextCursor: null
			})
		);
		await gotoApp(page, '/playlists');
		await expect(page.getByText('Morning Mix')).toBeVisible();
		await expect(page.getByText('5 tracks')).toBeVisible();
		await expect(page.getByText('Evening Chill')).toBeVisible();
		await expect(page.getByText('3 tracks')).toBeVisible();
	});

	test('shows error on fetch failure', async ({ page }) => {
		await page.route('**/api/playlists*', (route) =>
			json(route, { error: { code: 'internal_error', message: 'Failed.' } }, 500)
		);
		await gotoApp(page, '/playlists');
		await expect(page.getByText("Couldn't load playlists.")).toBeVisible();
	});

	test('navigates to playlist detail with tracks', async ({ page }) => {
		await page.route('**/api/playlists/pl_1', (route) =>
			json(route, playlist({ id: 'pl_1', name: 'Morning Mix', trackCount: 2, totalDurationMs: 600000 }))
		);
		await page.route('**/api/playlists/pl_1/tracks', (route) =>
			json(route, {
				items: [
					playlistTrack({ trackId: 'trk_a', position: 1, track: track({ id: 'trk_a', title: 'Sunrise', artist: 'Artist A', durationMs: 180000 }) }),
					playlistTrack({ trackId: 'trk_b', position: 2, track: track({ id: 'trk_b', title: 'Sunset', artist: 'Artist B', durationMs: 240000 }) })
				]
			})
		);
		await gotoApp(page, '/playlists/pl_1');
		await expect(page.getByText('Morning Mix')).toBeVisible();
		await expect(page.getByText('Sunrise')).toBeVisible();
		await expect(page.getByText('Sunset')).toBeVisible();
	});

	test('playlist detail shows empty track list', async ({ page }) => {
		await page.route('**/api/playlists/pl_1', (route) =>
			json(route, playlist({ id: 'pl_1', name: 'Empty Playlist', trackCount: 0, totalDurationMs: 0 }))
		);
		await page.route('**/api/playlists/pl_1/tracks', (route) =>
			json(route, { items: [] })
		);
		await gotoApp(page, '/playlists/pl_1');
		await expect(page.getByText('Empty Playlist')).toBeVisible();
		await expect(page.getByText('This playlist is empty.')).toBeVisible();
	});

	test('playlist detail shows error on tracks fetch failure', async ({ page }) => {
		await page.route('**/api/playlists/pl_1', (route) =>
			json(route, playlist({ id: 'pl_1', name: 'Morning Mix', trackCount: 2, totalDurationMs: 600000 }))
		);
		await page.route('**/api/playlists/pl_1/tracks', (route) =>
			json(route, { error: { code: 'internal_error', message: 'Failed.' } }, 500)
		);
		await gotoApp(page, '/playlists/pl_1');
		await expect(page.getByText("Couldn't load this playlist.")).toBeVisible();
	});

	test('renders in 中文 when locale is zh', async ({ browser }) => {
		const context = await browser.newContext({ locale: 'zh-CN' });
		const page = await context.newPage();
		await mockApi(page);
		try {
			await gotoApp(page, '/playlists');
			await expect(page.getByRole('heading', { name: '播放列表' })).toBeVisible();
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

async function mockApi(page: Page) {
	await page.route('**/api/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname.replace(/^\/api/, '');

		if (path === '/auth/session') return json(route, session());
		if (path === '/queue') return json(route, { items: [], currentItemId: null, updatedAt: null });
		if (path === '/me/continue-listening' || path === '/me/recent-tracks') return json(route, { items: [], nextCursor: null });
		if (path.match(/^\/tracks($|\/)/)) return json(route, { items: [], nextCursor: null });
		if (path.match(/^\/playlists\/[^/]+\/tracks/)) return json(route, { items: [] });
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

function playlist(overrides: Record<string, unknown> = {}) {
	return {
		id: 'pl_a', tenantId: 'tnt_a', name: 'Playlist', description: null,
		trackCount: 0, totalDurationMs: 0,
		createdAt: '2026-04-26T00:00:00.000Z', updatedAt: '2026-04-26T00:00:00.000Z',
		...overrides
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

function playlistTrack(overrides: Record<string, unknown> = {}) {
	return {
		trackId: 'trk_a', position: 1, addedAt: '2026-04-26T00:00:00.000Z',
		track: track(), ...overrides
	};
}
