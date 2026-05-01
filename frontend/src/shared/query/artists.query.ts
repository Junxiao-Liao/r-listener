import {
	createQuery,
	type CreateQueryResult
} from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { suppressGlobalApiErrorToast } from '$shared/feedback/error-toast.service';
import { queryKeys } from '$shared/query/keys';
import type { ArtistAggregateDto, ArtistTrackListResponse, ArtistsListResponse, Id } from '$shared/types/dto';

export function useArtistsQuery(
	params: () => { q?: string } = () => ({})
): CreateQueryResult<ArtistsListResponse, ApiError> {
	return createQuery<ArtistsListResponse, ApiError>({
		get queryKey() {
			const p = params();
			return queryKeys.artistsList({ q: p.q, limit: 100 });
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => {
			const p = params();
			const search = new URLSearchParams();
			if (p.q) search.set('q', p.q);
			search.set('limit', '100');
			const qs = search.toString();
			return api<ArtistsListResponse>(`/artists${qs ? `?${qs}` : ''}`);
		}
	});
}

export function useArtistQuery(
	id: () => Id<'artist'> | null,
	enabled: () => boolean = () => true
): CreateQueryResult<ArtistAggregateDto, ApiError> {
	return createQuery<ArtistAggregateDto, ApiError>({
		get queryKey() {
			return queryKeys.artistDetail(id() ?? '');
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<ArtistAggregateDto>(`/artists/${id()}`),
		get enabled() {
			return enabled() && id() !== null;
		}
	});
}

export function useArtistTracksQuery(
	id: () => Id<'artist'> | null,
	enabled: () => boolean = () => true
): CreateQueryResult<ArtistTrackListResponse, ApiError> {
	return createQuery<ArtistTrackListResponse, ApiError>({
		get queryKey() {
			return queryKeys.artistTracks(id() ?? '');
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<ArtistTrackListResponse>(`/artists/${id()}/tracks`),
		get enabled() {
			return enabled() && id() !== null;
		}
	});
}
