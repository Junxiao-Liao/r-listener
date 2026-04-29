import { expect, type Page, type Route, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await mockApi(page);
});

test('home renders empty states for a new tenant', async ({ page }) => {
	await gotoApp(page, '/');

	await expect(page.getByRole('heading', { name: 'Family Music' })).toBeVisible();
	await expect(page.getByText('Nothing to resume yet.')).toBeVisible();
	await expect(page.getByText('Play a track and it will appear here.')).toBeVisible();
	await expect(page.getByText('No tracks in this workspace yet.')).toBeVisible();
	await expect(page.getByText('No playlists in this workspace yet.')).toBeVisible();
});

test('home navigation reaches upload, library, playlists, and player flows', async ({ page }) => {
	await gotoApp(page, '/');

	await page.getByRole('link', { name: /^Upload$/ }).click();
	await expect(page).toHaveURL(/\/library\/upload$/);
	await expect(page.getByRole('heading', { name: 'Upload music' })).toBeVisible();

	await gotoApp(page, '/');
	await page.getByRole('link', { name: /^Library$/ }).first().click();
	await expect(page).toHaveURL(/\/library$/);
	await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

	await gotoApp(page, '/');
	await page.getByRole('link', { name: /^Playlists$/ }).first().click();
	await expect(page).toHaveURL(/\/playlists$/);
	await expect(page.getByRole('heading', { name: 'Playlists' })).toBeVisible();

	await gotoApp(page, '/');
	await page.getByRole('link', { name: /^Player$/ }).first().click();
	await expect(page).toHaveURL(/\/player$/);
	await expect(page.getByText('Nothing playing yet.')).toBeVisible();
});

test('home search navigates to the dedicated search page', async ({ page }) => {
	await gotoApp(page, '/');

	await page.getByLabel('Search tracks and playlists').fill('sun');
	await page.getByRole('button', { name: 'Search' }).click();

	await expect(page).toHaveURL(/\/search\?q=sun$/);
	await expect(page.getByRole('heading', { name: 'Tracks' })).toBeVisible();
	await expect(page.getByText('Sunrise')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Playlists' })).toBeVisible();
	await expect(page.getByText('Sunny Mix')).toBeVisible();
});

test('search page renders grouped empty and error states', async ({ page }) => {
	await gotoApp(page, '/search?q=missing');
	await expect(page.getByText('No results for “missing”.')).toBeVisible();

	await gotoApp(page, '/search?q=error');
	await expect(page.getByText("Couldn't load search results.")).toBeVisible();
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

		if (path === '/auth/session') {
			return json(route, session());
		}

		if (path === '/queue') {
			return json(route, { items: [], currentItemId: null, updatedAt: null });
		}

		if (path === '/me/continue-listening' || path === '/me/recent-tracks') {
			return json(route, { items: [], nextCursor: null });
		}

		if (path === '/tracks') {
			return json(route, { items: [], nextCursor: null });
		}

		if (path === '/playlists') {
			return json(route, { items: [], nextCursor: null });
		}

		if (path === '/search') {
			const q = url.searchParams.get('q') ?? '';
			if (q === 'error') {
				return json(
					route,
					{ error: { code: 'internal_error', message: 'Search failed.' } },
					500
				);
			}
			if (q === 'missing') {
				return json(route, { items: [], nextCursor: null });
			}
			return json(route, {
				items: [
					{ kind: 'track', track: track({ id: 'trk_sunrise', title: 'Sunrise' }) },
					{
						kind: 'playlist',
						playlist: playlist({ id: 'pl_sunny', name: 'Sunny Mix', trackCount: 3 })
					}
				],
				nextCursor: null
			});
		}

		return json(route, { error: { code: 'not_found', message: 'Not mocked.' } }, 404);
	});
}

function json(route: Route, body: unknown, status = 200) {
	return route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

function session() {
	return {
		user: {
			id: 'usr_a',
			username: 'alice',
			isAdmin: false,
			isActive: true,
			lastActiveTenantId: 'tnt_a',
			createdAt: '2026-04-26T00:00:00.000Z'
		},
		tenants: [
			{
				tenantId: 'tnt_a',
				tenantName: 'Family Music',
				role: 'member',
				createdAt: '2026-04-26T00:00:00.000Z'
			}
		],
		preferences: {
			language: 'en',
			theme: 'system',
			autoPlayNext: true,
			showMiniPlayer: true,
			preferSyncedLyrics: true,
			defaultLibrarySort: 'createdAt:desc',
			updatedAt: '2026-04-26T00:00:00.000Z'
		},
		activeTenantId: 'tnt_a',
		sessionExpiresAt: '2026-05-26T00:00:00.000Z'
	};
}

function track(overrides: Record<string, unknown> = {}) {
	return {
		id: 'trk_a',
		tenantId: 'tnt_a',
		title: 'Track',
		artist: 'Artist',
		album: 'Album',
		trackNumber: null,
		genre: null,
		year: null,
		durationMs: 180000,
		coverUrl: null,
		lyricsLrc: null,
		lyricsStatus: 'none',
		contentType: 'audio/mpeg',
		sizeBytes: 1024,
		status: 'ready',
		createdAt: '2026-04-26T00:00:00.000Z',
		updatedAt: '2026-04-26T00:00:00.000Z',
		...overrides
	};
}

function playlist(overrides: Record<string, unknown> = {}) {
	return {
		id: 'pl_a',
		tenantId: 'tnt_a',
		name: 'Playlist',
		description: null,
		trackCount: 0,
		totalDurationMs: 0,
		createdAt: '2026-04-26T00:00:00.000Z',
		updatedAt: '2026-04-26T00:00:00.000Z',
		...overrides
	};
}
