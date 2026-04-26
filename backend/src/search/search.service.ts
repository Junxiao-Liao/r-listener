import type { SearchRepository } from './search.repository';

export type SearchService = {
	readonly searchRepository: SearchRepository;
};

export function createSearchService(searchRepository: SearchRepository): SearchService {
	return { searchRepository };
}
