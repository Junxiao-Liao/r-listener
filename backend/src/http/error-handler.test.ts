import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { createTestEnv } from '../test/test-env';
import { apiError } from './api-error';
import { registerErrorHandlers } from './error-handler';

describe('error handlers', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('logs unexpected errors and exposes details in test/local responses', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const app = createFixtureApp(() => {
			throw new Error('no such column: user_preferences.theme');
		});

		const res = await app.request('/boom', {}, createTestEnv());

		expect(res.status).toBe(500);
		await expect(res.json()).resolves.toMatchObject({
			error: {
				code: 'internal_error',
				message: 'Internal server error.',
				details: {
					name: 'Error',
					message: 'no such column: user_preferences.theme'
				}
			}
		});
		expect(consoleError).toHaveBeenCalledWith(
			'Unexpected API error',
			expect.objectContaining({
				method: 'GET',
				path: '/boom',
				name: 'Error',
				message: 'no such column: user_preferences.theme'
			})
		);
	});

	it('keeps production unexpected error responses generic', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const app = createFixtureApp(() => {
			throw new Error('secret backend detail');
		});

		const res = await app.request('https://api.example.com/boom', {}, createTestEnv({ ENVIRONMENT: 'production' }));

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({
			error: {
				code: 'internal_error',
				message: 'Internal server error.'
			}
		});
	});

	it('does not log handled API errors', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const app = createFixtureApp(() => {
			throw apiError(400, 'validation_failed', 'Invalid input.', { _: 'Bad input.' });
		});

		const res = await app.request('/boom', {}, createTestEnv());

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: {
				code: 'validation_failed',
				message: 'Invalid input.',
				fields: { _: 'Bad input.' }
			}
		});
		expect(consoleError).not.toHaveBeenCalled();
	});
});

function createFixtureApp(handler: () => Response | never) {
	const app = new Hono<BackendEnv>();
	registerErrorHandlers(app);
	app.get('/boom', handler);
	return app;
}
