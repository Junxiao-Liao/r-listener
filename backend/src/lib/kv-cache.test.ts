import { describe, expect, it, vi } from 'vitest';
import { cacheKey, cachePrefix, createKvCache } from './kv-cache';

describe('kv cache', () => {
	it('returns cached JSON without calling the fetcher', async () => {
		const kv = mockKv({ [cacheKey('cache:test', 'a')]: { value: 1 } });
		const cache = createKvCache(kv);
		const fetcher = vi.fn(async () => ({ value: 2 }));

		await expect(cache.get(cacheKey('cache:test', 'a'), fetcher)).resolves.toEqual({ value: 1 });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('populates KV on cache miss', async () => {
		const kv = mockKv();
		const cache = createKvCache(kv, { defaultTtlSeconds: 123 });

		await expect(cache.get('cache:test:miss', async () => ({ value: 3 }))).resolves.toEqual({
			value: 3
		});

		expect(kv.put).toHaveBeenCalledWith(
			'cache:test:miss',
			JSON.stringify({ value: 3 }),
			{ expirationTtl: 123 }
		);
	});

	it('does not cache not-found results', async () => {
		const kv = mockKv();
		const cache = createKvCache(kv);

		await expect(cache.get('cache:test:none', async () => null)).resolves.toBeNull();
		expect(kv.put).not.toHaveBeenCalled();
	});

	it('fails open when KV get or put throws', async () => {
		const kv = mockKv(undefined, {
			get: vi.fn(async () => {
				throw new Error('get unavailable');
			}),
			put: vi.fn(async () => {
				throw new Error('put unavailable');
			})
		});
		const cache = createKvCache(kv);

		await expect(cache.get('cache:test:fallback', async () => ({ value: 4 }))).resolves.toEqual({
			value: 4
		});
	});

	it('invalidates all keys under a prefix and ignores list/delete failures', async () => {
		const kv = mockKv({
			[cacheKey('cache:test:list', 'tenant', { page: 1 })]: { value: 1 },
			[cacheKey('cache:test:list', 'tenant', { page: 2 })]: { value: 2 }
		});
		const cache = createKvCache(kv);

		await cache.invalidatePrefix(cachePrefix('cache:test:list', 'tenant'));

		expect(kv.delete).toHaveBeenCalledTimes(2);

		const failing = mockKv(undefined, {
			list: vi.fn(async () => {
				throw new Error('list unavailable');
			})
		});
		await expect(createKvCache(failing).invalidatePrefix('cache:test:')).resolves.toBeUndefined();
	});
});

function mockKv(
	initial: Record<string, unknown> = {},
	overrides: Partial<KVNamespace> = {}
): KVNamespace {
	const values = new Map(
		Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)])
	);
	return {
		get: vi.fn(async (key: string, type?: string) => {
			const value = values.get(key);
			if (value === undefined) return null;
			return type === 'json' ? JSON.parse(value) : value;
		}),
		put: vi.fn(async (key: string, value: string) => {
			values.set(key, value);
		}),
		delete: vi.fn(async (key: string) => {
			values.delete(key);
		}),
		list: vi.fn(async ({ prefix }: { prefix?: string } = {}) => ({
			keys: [...values.keys()]
				.filter((key) => (prefix ? key.startsWith(prefix) : true))
				.map((name) => ({ name })),
			list_complete: true,
			cursor: '',
			cacheStatus: null
		})),
		...overrides
	} as unknown as KVNamespace;
}
