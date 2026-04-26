import { describe, expect, it } from 'vitest';
import app from './index';
import { createTestEnv } from './test/test-env';

describe('backend app', () => {
	it('responds to health checks', async () => {
		const res = await app.request('/health', {}, createTestEnv());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	it('serves wired auth routes', async () => {
		const res = await app.request(
			'/auth/signin',
			{
				method: 'POST',
				headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
				body: JSON.stringify({ username: 'alice', password: 'wrong' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({
			error: { code: 'invalid_credentials', message: 'Username or password is wrong.' }
		});
	});
});
