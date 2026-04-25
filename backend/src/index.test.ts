import { describe, expect, it } from 'vitest';
import app from './index';
import { createTestEnv } from './test/test-env';

describe('backend app', () => {
	it('responds to health checks', async () => {
		const res = await app.request('/health', {}, createTestEnv());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});
