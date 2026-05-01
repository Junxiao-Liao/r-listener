import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { validationError } from '../http/api-error';
import type { SearchRepository } from './search.repository';
import { createSearchRepository } from './search.repository';
import type { SearchQuery } from './search.dto';
import type { SearchResultDto } from './search.type';
import { cacheKey, createKvCache, KV_TTL } from '../lib/kv-cache';

export type SearchService = {
	search(input: SearchServiceInput): Promise<SearchResultDto>;
};

export type SearchServiceInput = SearchQuery & {
	tenantId: Id<'tenant'>;
};

export function createSearchService(searchRepository: SearchRepository, kv?: KVNamespace): SearchService {
	const cache = kv ? createKvCache(kv, { defaultTtlSeconds: KV_TTL.highChurn }) : null;

	function searchCacheKey(tenantId: Id<'tenant'>, q: string, kinds: string[], limit: number, cursor?: string): string {
		return cacheKey('cache:search', tenantId, { cursor, kinds: [...kinds].sort(), limit, q });
	}

	return {
		search: async (input) => {
			const q = input.q.trim();
			if (!q) {
				throw validationError({ q: 'Query is required.' });
			}

			const key = cache ? searchCacheKey(input.tenantId, q, input.kinds, input.limit, input.cursor) : null;

			if (key && cache) {
				const cached = await cache.tryGet<SearchResultDto>(key);
				if (cached) return cached;
			}

			const result = await searchRepository.search({ ...input, q });

			if (key && cache) {
				await cache.put(key, result, 60);
			}

			return result;
		}
	};
}

export function createSearchServiceForDb(db: Db, kv?: KVNamespace): SearchService {
	return createSearchService(createSearchRepository(db), kv);
}
