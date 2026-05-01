export type KvCacheOptions = {
	defaultTtlSeconds: number;
};

const DEFAULT_TTL = 300;

export const KV_TTL = {
	mutable: 300,
	authz: 600,
	highChurn: 60
} as const;

type CacheKeyPart = string | number | boolean | null | undefined | readonly CacheKeyPart[] | {
	readonly [key: string]: CacheKeyPart;
};

export function cacheKey(prefix: string, ...parts: CacheKeyPart[]): string {
	return [prefix, ...parts.map(encodeCacheKeyPart)].join(':');
}

export function cachePrefix(prefix: string, ...parts: Array<string | number | boolean>): string {
	return [prefix, ...parts.map((part) => encodeCacheKeyPart(part))].join(':') + ':';
}

export function reviveDateFields<T extends Record<string, unknown>>(
	value: T,
	fields: readonly (keyof T)[]
): T {
	const next = { ...value };
	for (const field of fields) {
		const current = next[field];
		if (typeof current === 'string' || typeof current === 'number') {
			next[field] = new Date(current) as T[keyof T];
		}
	}
	return next;
}

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

function encodeCacheKeyPart(part: CacheKeyPart): string {
	return encodeURIComponent(stableStringify(part));
}

function stableStringify(value: CacheKeyPart): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(',')}]`;
	}
	if (value && typeof value === 'object') {
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
}
