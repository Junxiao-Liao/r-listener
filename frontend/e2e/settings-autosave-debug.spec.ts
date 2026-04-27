import { expect, test, type Page } from '@playwright/test';

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

type CapturedResponse = {
	url: string;
	method: string;
	status: number;
	body: string;
};

test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to debug Settings autosave');

test('settings visual preference autosave returns a non-500 response', async ({ page }, testInfo) => {
	const debugLog: string[] = [];
	const responseUrls: string[] = [];
	const mainFrameNavigations: string[] = [];
	const preferenceResponses: CapturedResponse[] = [];

	captureDebug(page, debugLog, responseUrls, mainFrameNavigations, preferenceResponses);

	try {
		await signIn(page, username!, password!);
		await page.goto('/settings');

		await clickDifferentAppearance(page);

		await expect
			.poll(() => preferenceResponses.length, { message: 'wait for Settings preference PATCH' })
			.toBeGreaterThan(0);

		const latest = preferenceResponses.at(-1);
		expect(latest?.status, JSON.stringify({ latest, debugLog }, null, 2)).toBeLessThan(500);

		const responsesBeforeLanguage = responseUrls.length;
		const navigationsBeforeLanguage = mainFrameNavigations.length;
		const preferencesBeforeLanguage = preferenceResponses.length;

		await setLanguageToChinese(page, preferenceResponses);

		await expect
			.poll(() => preferenceResponses.length, { message: 'wait for Settings language PATCH' })
			.toBeGreaterThan(preferencesBeforeLanguage);

		const languageResponse = preferenceResponses.at(-1);
		const languageResponseCount = responseUrls.length - responsesBeforeLanguage;
		expect(
			languageResponse?.status,
			JSON.stringify({ languageResponse, debugLog }, null, 2)
		).toBeLessThan(500);
		expect(
			mainFrameNavigations.length,
			JSON.stringify({ mainFrameNavigations, debugLog }, null, 2)
		).toBe(navigationsBeforeLanguage);
		expect(languageResponseCount, JSON.stringify({ responseUrls, debugLog }, null, 2)).toBeLessThan(
			30
		);

		const responsesBeforeRefresh = responseUrls.length;
		await page.reload();
		await page.waitForTimeout(1_200);
		await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
		await expect(page.getByRole('radio', { name: '中文' })).toHaveAttribute('aria-checked', 'true');
		await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'false');

		const postRefreshResponseCount = responseUrls.length - responsesBeforeRefresh;
		expect(
			mainFrameNavigations.length,
			JSON.stringify({ mainFrameNavigations, debugLog }, null, 2)
		).toBe(navigationsBeforeLanguage + 1);
		expect(
			postRefreshResponseCount,
			JSON.stringify({ responseUrls, debugLog }, null, 2)
		).toBeLessThan(60);
	} finally {
		await testInfo.attach('settings-autosave-debug.json', {
			body: JSON.stringify({ preferenceResponses, responseUrls, mainFrameNavigations, debugLog }, null, 2),
			contentType: 'application/json'
		});
	}
});

function captureDebug(
	page: Page,
	debugLog: string[],
	responseUrls: string[],
	mainFrameNavigations: string[],
	preferenceResponses: CapturedResponse[]
): void {
	page.on('console', (message) => {
		if (message.type() === 'error') {
			debugLog.push(`console:error ${message.text()}`);
		}
	});

	page.on('requestfailed', (request) => {
		debugLog.push(
			`requestfailed ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`
		);
	});

	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) {
			mainFrameNavigations.push(frame.url());
		}
	});

	page.on('response', (response) => {
		const url = response.url();
		responseUrls.push(url);
		if (!url.includes('/settings/preferences') && !url.includes('/me/preferences')) return;

		void response.text().then((body) => {
			preferenceResponses.push({
				url,
				method: response.request().method(),
				status: response.status(),
				body
			});
		});
	});
}

async function signIn(page: Page, username: string, password: string): Promise<void> {
	await page.goto('/signin');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForLoadState('networkidle');
}

async function clickDifferentAppearance(page: Page): Promise<void> {
	const light = page.getByRole('radio', { name: 'Light' });
	const dark = page.getByRole('radio', { name: 'Dark' });
	const darkSelected = (await dark.getAttribute('aria-checked')) === 'true';
	await (darkSelected ? light : dark).click();
}

async function setLanguageToChinese(page: Page, preferenceResponses: CapturedResponse[]): Promise<void> {
	const english = page.getByRole('radio', { name: 'English' });
	const chinese = page.getByRole('radio', { name: '中文' });
	const chineseSelected = (await chinese.getAttribute('aria-checked')) === 'true';
	if (!chineseSelected) {
		await chinese.click();
		return;
	}

	const responsesBeforeEnglish = preferenceResponses.length;
	await english.click();
	await expect
		.poll(() => preferenceResponses.length, { message: 'wait for Settings language PATCH (English)' })
		.toBeGreaterThan(responsesBeforeEnglish);
	await chinese.click();
}
