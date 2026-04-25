import { expect, test } from '@playwright/test';

test('renders the root page', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'R Listener' })).toBeVisible();
	await expect(page.getByText('Private music library')).toBeVisible();
});
