import {
	createMutation,
	createQuery,
	useQueryClient,
	type CreateQueryResult
} from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { suppressGlobalApiErrorToast } from '$shared/feedback/error-toast.service';
import { queryKeys } from '$shared/query/keys';
import type { PlaybackEventInput, RecentTracksResponse } from '$shared/types/dto';

export function useRecentTracksQuery(): CreateQueryResult<RecentTracksResponse, ApiError> {
	return createQuery<RecentTracksResponse, ApiError>({
		queryKey: queryKeys.recentTracks,
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<RecentTracksResponse>('/me/recent-tracks?limit=20')
	});
}

export function useContinueListeningQuery(): CreateQueryResult<RecentTracksResponse, ApiError> {
	return createQuery<RecentTracksResponse, ApiError>({
		queryKey: queryKeys.continueListening,
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<RecentTracksResponse>('/me/continue-listening?limit=10')
	});
}

export function usePlaybackEventsMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, PlaybackEventInput[]>({
		mutationFn: (events) =>
			api<void>('/playback-events', { method: 'POST', body: { events } }),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: queryKeys.recentTracks });
			void qc.invalidateQueries({ queryKey: queryKeys.continueListening });
		}
	});
}
