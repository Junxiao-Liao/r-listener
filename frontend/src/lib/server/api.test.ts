import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api';

describe('createApiClient', () => {
	it('forwards the session cookie and JSON content type', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true }));
		const api = createApiClient({
			backendUrl: 'http://backend.test',
			sessionToken: 'session-token',
			fetch: fetch as unknown as typeof globalThis.fetch
		});

		await expect(api.request('/health', { method: 'POST', body: JSON.stringify({ ok: true }) })).resolves.toEqual({
			ok: true
		});

		const call = fetch.mock.calls[0];
		expect(call).toBeDefined();
		if (!call) {
			throw new Error('expected fetch to be called');
		}
		const [url, init] = call;
		const headers = new Headers(init?.headers);

		expect(String(url)).toBe('http://backend.test/health');
		expect(headers.get('cookie')).toBe('session=session-token');
		expect(headers.get('content-type')).toBe('application/json');
	});

	it('throws ApiError for non-2xx responses', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('nope', { status: 500 }));
		const api = createApiClient({
			backendUrl: 'http://backend.test',
			fetch: fetch as unknown as typeof globalThis.fetch
		});

		await expect(api.request('/health')).rejects.toEqual(new ApiError(500, 'nope'));
	});
});
