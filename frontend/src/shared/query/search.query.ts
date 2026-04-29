import { createQuery, type CreateQueryResult } from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { queryKeys } from '$shared/query/keys';
import type { SearchKind, SearchResponse } from '$shared/types/dto';

export type SearchQueryParams = {
	q: string;
	limit?: number;
	kinds?: SearchKind[];
};

export function useSearchQuery(
	params: () => SearchQueryParams
): CreateQueryResult<SearchResponse, ApiError> {
	return createQuery<SearchResponse, ApiError>({
		get queryKey() {
			const p = normalize(params());
			return queryKeys.search({
				q: p.q,
				limit: p.limit,
				kinds: p.kinds?.join(',')
			});
		},
		queryFn: () => {
			const p = normalize(params());
			return api<SearchResponse>(buildSearchPath(p));
		},
		get enabled() {
			return normalize(params()).q.length > 0;
		}
	});
}

export function buildSearchPath(params: SearchQueryParams): string {
	const p = normalize(params);
	const search = new URLSearchParams();
	search.set('q', p.q);
	search.set('limit', String(p.limit));
	if (p.kinds && p.kinds.length > 0) search.set('kinds', p.kinds.join(','));
	return `/search?${search.toString()}`;
}

function normalize(params: SearchQueryParams): Required<Pick<SearchQueryParams, 'q' | 'limit'>> &
	Pick<SearchQueryParams, 'kinds'> {
	return {
		q: params.q.trim(),
		limit: params.limit ?? 20,
		kinds: params.kinds
	};
}
