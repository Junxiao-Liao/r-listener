import { expect, type Page, type Route, test } from '@playwright/test';

const passwordPolicyMessage =
	'Password must be at least 12 characters and include at least 3 of lowercase, uppercase, digit, symbol.';

test.beforeEach(async ({ page }) => {
	await mockApi(page);
});

test('admin reset password validates before confirmation and reports API failures as a toast', async ({
	page
}) => {
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));

	await page.goto('/admin/users/usr_b');
	await expect(page.getByRole('heading', { name: 'User detail' })).toBeVisible();

	await page.getByLabel('New password').fill('short1!');
	await page.getByRole('button', { name: 'Reset password' }).click();

	await expect(page.getByText('Password is too weak.')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Reset password?' })).toBeHidden();
	expect(pageErrors).toEqual([]);

	await page.getByLabel('New password').fill('LongPassword!');
	await page.getByRole('button', { name: 'Reset password' }).click();
	await expect(page.getByRole('heading', { name: 'Reset password?' })).toBeVisible();
	await page.getByRole('button', { name: 'Reset password' }).last().click();

	await expect(page.getByRole('alert')).toContainText(`weak_password: ${passwordPolicyMessage}`);
	expect(pageErrors).toEqual([]);
});

async function mockApi(page: Page) {
	await page.route('**/api/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname.replace(/^\/api/, '');

		if (path === '/auth/session') return json(route, session());
		if (path === '/queue') return json(route, { items: [], currentItemId: null, updatedAt: null });
		if (path === '/admin/users/usr_b' && route.request().method() === 'GET') {
			return json(route, userDetail());
		}
		if (path === '/admin/users/usr_b/reset-password' && route.request().method() === 'POST') {
			return json(route, { error: { code: 'weak_password', message: passwordPolicyMessage } }, 422);
		}

		return json(route, { error: { code: 'not_found', message: 'Not mocked.' } }, 404);
	});
}

function json(route: Route, body: unknown, status = 200) {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function session() {
	return {
		user: {
			id: 'usr_a',
			username: 'alice',
			isAdmin: true,
			isActive: true,
			lastActiveTenantId: 'tnt_a',
			createdAt: '2026-04-26T00:00:00.000Z'
		},
		tenants: [
			{
				tenantId: 'tnt_a',
				tenantName: 'Family Music',
				role: 'owner',
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

function userDetail() {
	return {
		id: 'usr_b',
		username: 'bob',
		isAdmin: false,
		isActive: true,
		lastActiveTenantId: 'tnt_a',
		createdAt: '2026-04-26T00:00:00.000Z',
		memberships: [
			{
				tenantId: 'tnt_a',
				tenantName: 'Family Music',
				role: 'member',
				createdAt: '2026-04-26T00:00:00.000Z'
			}
		]
	};
}
