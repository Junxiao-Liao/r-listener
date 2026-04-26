import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api';

const stdOpts = {
	backendUrl: 'http://backend.test',
	frontendOrigin: 'http://app.test',
	sessionToken: 'session-token'
};

describe('createApiClient', () => {
	it('forwards the session cookie and JSON content type on POST', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true }));
		const api = createApiClient({
			...stdOpts,
			fetch: fetch as unknown as typeof globalThis.fetch
		});

		await expect(
			api.request('/health', { method: 'POST', body: JSON.stringify({ ok: true }) })
		).resolves.toEqual({ ok: true });

		const [url, init] = fetch.mock.calls[0]!;
		const headers = new Headers(init?.headers);

		expect(String(url)).toBe('http://backend.test/health');
		expect(headers.get('cookie')).toBe('session=session-token');
		expect(headers.get('content-type')).toBe('application/json');
		expect(headers.get('origin')).toBe('http://app.test');
	});

	it('does not stamp Origin on GET (backend only enforces it on mutations)', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true }));
		const api = createApiClient({
			...stdOpts,
			fetch: fetch as unknown as typeof globalThis.fetch
		});

		await api.request('/health');

		const init = fetch.mock.calls[0]![1];
		expect(new Headers(init?.headers).get('origin')).toBe(null);
	});

	it('invokes onResponse so callers can read response headers', async () => {
		const headers = new Headers({ 'X-Session-Expires-At': '2030-01-01T00:00:00.000Z' });
		const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true }, { headers }));
		const onResponse = vi.fn();
		const api = createApiClient({
			...stdOpts,
			fetch: fetch as unknown as typeof globalThis.fetch
		});

		await api.request('/auth/session', { onResponse });
		expect(onResponse).toHaveBeenCalledOnce();
		expect(onResponse.mock.calls[0]![0].headers.get('X-Session-Expires-At')).toBe(
			'2030-01-01T00:00:00.000Z'
		);
	});

	it('parses backend ApiErrorBody into ApiError with code/message', async () => {
		const body = { error: { code: 'invalid_credentials', message: 'Bad creds.' } };
		const fetch = vi.fn<typeof globalThis.fetch>(
			async () =>
				new Response(JSON.stringify(body), {
					status: 401,
					headers: { 'content-type': 'application/json' }
				})
		);
		const api = createApiClient({
			...stdOpts,
			fetch: fetch as unknown as typeof globalThis.fetch
		});

		await expect(api.request('/auth/signin', { method: 'POST' })).rejects.toMatchObject({
			status: 401,
			code: 'invalid_credentials',
			message: 'Bad creds.'
		});
	});

	it('falls back to internal_error when body is not JSON', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('boom', { status: 502 }));
		const api = createApiClient({
			...stdOpts,
			fetch: fetch as unknown as typeof globalThis.fetch
		});

		const err = (await api.request('/health').catch((e) => e)) as ApiError;
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(502);
		expect(err.code).toBe('internal_error');
	});
});
