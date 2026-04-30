import { expect, type Page, type Route, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await mockApi(page);
});

test.describe('settings', () => {
	test('renders account info and controls', async ({ page }) => {
		await gotoApp(page, '/settings');
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
		await expect(page.getByText('alice')).toBeVisible();
		await expect(page.getByText('Family Music')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Switch workspace' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Change password' })).toBeVisible();
		await expect(page.getByText('Sign out')).toBeVisible();
	});

	test('has workspace swich and change password links', async ({ page }) => {
		await gotoApp(page, '/settings');
		const switchBtn = page.getByRole('link', { name: 'Switch workspace' });
		await expect(switchBtn).toHaveAttribute('href', '/tenants');

		const changePwBtn = page.getByRole('link', { name: 'Change password' });
		await expect(changePwBtn).toHaveAttribute('href', '/settings/change-password');
	});

	test('shows admin entry for admin users', async ({ page }) => {
		await page.route('**/api/auth/session', (route) =>
			json(route, { ...session(), user: { ...session().user, isAdmin: true } })
		);
		await gotoApp(page, '/settings');
		await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
	});

	test('renders in 中文 when locale is zh', async ({ browser }) => {
		const context = await browser.newContext({ locale: 'zh-CN' });
		const page = await context.newPage();
		await mockApi(page);
		try {
			await gotoApp(page, '/settings');
			await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
			await expect(page.getByText('退出登录')).toBeVisible();
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
		if (path === '/me/preferences') return json(route, session().preferences);
		if (path === '/me/continue-listening' || path === '/me/recent-tracks') return json(route, { items: [], nextCursor: null });
		if (path.match(/^\/tracks($|\/)/)) return json(route, { items: [], nextCursor: null });
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
