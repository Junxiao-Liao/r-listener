import { describe, expect, it, vi } from 'vitest';
import type { Id } from '../shared/shared.type';
import { createSearchService } from './search.service';
import type { SearchRepository } from './search.repository';

describe('search service cache', () => {
	it('reuses cached search result pages', async () => {
		const repository: SearchRepository = {
			search: vi.fn(async () => ({ items: [], nextCursor: null }))
		};
		const kv = mockKv();
		const service = createSearchService(repository, kv);
		const input = {
			tenantId: 'tnt_a' as Id<'tenant'>,
			q: 'sun',
			kinds: ['track', 'playlist'] as Array<'track' | 'playlist'>,
			limit: 10
		};

		await service.search(input);
		await service.search(input);

		expect(repository.search).toHaveBeenCalledTimes(1);
		expect(kv.put).toHaveBeenCalledTimes(1);
	});

	it('falls back to repository reads when KV throws', async () => {
		const repository: SearchRepository = {
			search: vi.fn(async () => ({ items: [], nextCursor: null }))
		};
		const service = createSearchService(repository, mockKv({ throws: true }));

		await expect(
			service.search({
				tenantId: 'tnt_a' as Id<'tenant'>,
				q: 'sun',
				kinds: ['track'],
				limit: 10
			})
		).resolves.toEqual({ items: [], nextCursor: null });
		expect(repository.search).toHaveBeenCalledTimes(1);
	});
});

function mockKv(options: { throws?: boolean } = {}): KVNamespace {
	const values = new Map<string, string>();
	return {
		get: vi.fn(async (key: string, type?: string) => {
			if (options.throws) throw new Error('kv unavailable');
			const value = values.get(key);
			if (value === undefined) return null;
			return type === 'json' ? JSON.parse(value) : value;
		}),
		put: vi.fn(async (key: string, value: string) => {
			if (options.throws) throw new Error('kv unavailable');
			values.set(key, value);
		}),
		delete: vi.fn(async () => {}),
		list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '', cacheStatus: null }))
	} as unknown as KVNamespace;
}
