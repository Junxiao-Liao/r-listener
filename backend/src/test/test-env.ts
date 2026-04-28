import type { BackendEnv as Env } from '../app.type';

export function createTestEnv(overrides: Partial<Env['Bindings']> = {}): Env['Bindings'] {
	return {
		DB: createMockD1(),
		R2: createMockR2(),
		KV: createMockKV(),
		ASSETS: createMockAssets(),
		SESSION_SECRET: 'test-session-secret',
		...overrides
	};
}

function createMockD1(): D1Database {
	const statement = {
		bind: () => statement,
		first: async () => null,
		run: async () => ({ success: true }),
		all: async () => ({ results: [], success: true }),
		raw: async () => []
	};

	return {
		prepare: () => statement,
		batch: async () => [],
		exec: async () => ({ count: 0, duration: 0 })
	} as unknown as D1Database;
}

function createMockR2(): R2Bucket {
	return {} as R2Bucket;
}

function createMockKV(): KVNamespace {
	const values = new Map<string, string>();
	return {
		get: async (key: string) => values.get(key) ?? null,
		put: async (key: string, value: string) => {
			values.set(key, value);
		}
	} as unknown as KVNamespace;
}

function createMockAssets(): Fetcher {
	return {
		fetch: async () => new Response(null, { status: 404 })
	} as unknown as Fetcher;
}
