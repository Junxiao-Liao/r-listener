import { expect, test } from '@playwright/test';

test('signed-out user is redirected to /signin', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/signin$/);
});

test('signin renders the form in English by default', async ({ page }) => {
	await page.goto('/signin');
	await expect(page.getByRole('heading', { name: 'R Listener' })).toBeVisible();
	await expect(page.getByText('Your private music library')).toBeVisible();
	await expect(page.getByLabel('Username')).toBeVisible();
	await expect(page.getByLabel('Password')).toBeVisible();
	await expect(page.getByText('Username is required.')).toBeHidden();
	await expect(page.getByText('Password is required.')).toBeHidden();
});

test('signin required errors clear when fields are filled', async ({ page }) => {
	await page.goto('/signin');

	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByText('Username is required.')).toBeVisible();
	await expect(page.getByText('Password is required.')).toBeVisible();

	await page.getByLabel('Username').fill('alice');
	await page.getByLabel('Password').fill('password');

	await expect(page.getByText('Username is required.')).toBeHidden();
	await expect(page.getByText('Password is required.')).toBeHidden();
});

test('the page renders in 中文 when the paraglide cookie is zh', async ({ page, context }) => {
	await context.addCookies([
		{ name: 'PARAGLIDE_LOCALE', value: 'zh', url: 'http://127.0.0.1:4173' }
	]);
	await page.goto('/signin');
	await expect(page.getByText('你的私人音乐库')).toBeVisible();
});

test('the locale toggle is reachable from /signin', async ({ page }) => {
	await page.goto('/signin');
	await expect(page.getByRole('button', { name: 'EN' })).toBeVisible();
	await expect(page.getByRole('button', { name: '中文' })).toBeVisible();
});
