import { expect, type Page, type Route, test } from '@playwright/test';

let queueData: unknown = { items: [], currentItemId: null, updatedAt: null };

test.beforeEach(async ({ page }) => {
	queueData = { items: [], currentItemId: null, updatedAt: null };
	await mockApi(page);
});

test.describe('queue', () => {
	test('shows empty queue state', async ({ page }) => {
		await gotoApp(page, '/queue');
		await expect(page.getByRole('heading', { name: 'Queue' })).toBeVisible();
		await expect(page.getByText('Your queue is empty.')).toBeVisible();
	});

	test('lists queued items with now-playing marker', async ({ page }) => {
		queueData = {
			items: [
				queueItem({ id: 'qi_1', position: 1, isCurrent: true, track: track({ id: 'trk_a', title: 'Sunrise', artist: 'Artist A', durationMs: 180000 }) }),
				queueItem({ id: 'qi_2', position: 2, isCurrent: false, track: track({ id: 'trk_b', title: 'Sunset', artist: 'Artist B', durationMs: 240000 }) })
			],
			currentItemId: 'qi_1',
			updatedAt: '2026-04-26T00:00:00.000Z'
		};
		await page.goto('/queue', { timeout: 15000 });
		await page.waitForSelector('text=Queue', { timeout: 10000 });
		await page.waitForSelector('text=Sunrise', { timeout: 15000 });
		await expect(page.getByText('Sunrise').first()).toBeVisible();
		await expect(page.getByText('Now playing').first()).toBeVisible();
		await expect(page.getByText('Sunset').first()).toBeVisible();
		await expect(page.getByText('4:00').first()).toBeVisible();
	});

	test('shows error on queue fetch failure', async ({ page }) => {
		queueData = { __status: 500, error: { code: 'internal_error', message: 'Failed.' } };
		await gotoApp(page, '/queue');
		await expect(page.getByText("Couldn't load queue.")).toBeVisible();
	});

	test('renders in 中文 when locale is zh', async ({ browser }) => {
		const context = await browser.newContext({ locale: 'zh-CN' });
		const page = await context.newPage();
		await mockApi(page);
		try {
			await gotoApp(page, '/queue');
			await expect(page.getByRole('heading', { name: '播放队列' })).toBeVisible();
		} finally {
			await context.close();
		}
	});
});

async function gotoApp(page: Page, url: string) {
	await page.goto(url).catch(() => {});
	await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

async function mockApi(page: Page) {
	await page.route('**/api/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname.replace(/^\/api/, '');

		if (path === '/auth/session') return json(route, session());
		if (path === '/queue') {
			if (queueData && typeof queueData === 'object' && '__status' in queueData) {
				const { __status, ...rest } = queueData as Record<string, unknown>;
				return json(route, rest, __status as number | undefined);
			}
			return json(route, queueData);
		}
		if (path === '/me/continue-listening' || path === '/me/recent-tracks') return json(route, { items: [], nextCursor: null });
		if (path.match(/^\/tracks($|\/)/)) return json(route, { items: [], nextCursor: null });
		if (path === '/playlists') return json(route, { items: [], nextCursor: null });
		if (path === '/search') return json(route, { items: [], nextCursor: null });

		return json(route, { items: [], nextCursor: null });
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

function queueItem(overrides: Record<string, unknown> = {}) {
	return {
		id: 'qi_a', tenantId: 'tnt_a', userId: 'usr_a', trackId: 'trk_a',
		position: 1, isCurrent: false,
		addedAt: '2026-04-26T00:00:00.000Z', updatedAt: '2026-04-26T00:00:00.000Z',
		track: track(), ...overrides
	};
}
