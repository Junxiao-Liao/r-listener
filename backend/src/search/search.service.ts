import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { validationError } from '../http/api-error';
import type { SearchRepository } from './search.repository';
import { createSearchRepository } from './search.repository';
import type { SearchQuery } from './search.dto';
import type { SearchResultDto } from './search.type';

export type SearchService = {
	search(input: SearchServiceInput): Promise<SearchResultDto>;
};

export type SearchServiceInput = SearchQuery & {
	tenantId: Id<'tenant'>;
};

export function createSearchService(searchRepository: SearchRepository): SearchService {
	return {
		search: async (input) => {
			const q = input.q.trim();
			if (!q) {
				throw validationError({ q: 'Query is required.' });
			}
			return searchRepository.search({ ...input, q });
		}
	};
}

export function createSearchServiceForDb(db: Db): SearchService {
	return createSearchService(createSearchRepository(db));
}
