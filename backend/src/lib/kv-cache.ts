export type KvCacheOptions = {
	defaultTtlSeconds: number;
};

const DEFAULT_TTL = 300;

export function createKvCache(kv: KVNamespace, options: Partial<KvCacheOptions> = {}) {
	const defaultTtl = options.defaultTtlSeconds ?? DEFAULT_TTL;

	async function get<T>(key: string, fetcher: () => Promise<T | null>, ttlSeconds?: number): Promise<T | null> {
		try {
			const cached = await kv.get(key, 'json');
			if (cached !== null) return cached as T;
		} catch {
		}

		const fresh = await fetcher();
		if (fresh !== null) {
			try {
				await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds ?? defaultTtl });
			} catch {
			}
		}
		return fresh;
	}

	async function tryGet<T>(key: string): Promise<T | null> {
		try {
			return (await kv.get(key, 'json')) as T | null;
		} catch {
			return null;
		}
	}

	async function put<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
		try {
			await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds ?? defaultTtl });
		} catch {
		}
	}

	async function invalidate(key: string): Promise<void> {
		try {
			await kv.delete(key);
		} catch {
		}
	}

	async function invalidatePrefix(prefix: string): Promise<void> {
		try {
			const list = await kv.list({ prefix });
			for (const k of list.keys) {
				await kv.delete(k.name);
			}
		} catch {
		}
	}

	return { get, tryGet, put, invalidate, invalidatePrefix };
}

export type KvCache = ReturnType<typeof createKvCache>;
