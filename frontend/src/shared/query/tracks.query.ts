import {
	createInfiniteQuery,
	createMutation,
	createQuery,
	useQueryClient
} from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { suppressGlobalApiErrorToast } from '$shared/feedback/error-toast.service';
import { queryKeys } from '$shared/query/keys';
import type {
	FinalizeTrackInput,
	Id,
	TrackDto,
	TrackListResponse,
	TrackPatch,
	TrackSort
} from '$shared/types/dto';

export type TracksListParams = {
	sort: TrackSort;
	q?: string;
	includePending?: boolean;
};

export function useTracksInfiniteQuery(params: () => TracksListParams) {
	return createInfiniteQuery<
		TrackListResponse,
		ApiError,
		{ pages: TrackListResponse[]; pageParams: (string | null)[] },
		readonly unknown[],
		string | null
	>({
		get queryKey() {
			const p = params();
			return queryKeys.tracksList({
				sort: p.sort,
				q: p.q,
				includePending: !!p.includePending
			});
		},
		meta: suppressGlobalApiErrorToast,
		initialPageParam: null,
		queryFn: ({ pageParam }) => {
			const p = params();
			const search = new URLSearchParams();
			search.set('sort', p.sort);
			if (p.q && p.q.length > 0) search.set('q', p.q);
			if (p.includePending) search.set('includePending', 'true');
			if (pageParam) search.set('cursor', pageParam);
			return api<TrackListResponse>(`/tracks?${search.toString()}`);
		},
		getNextPageParam: (last) => last.nextCursor ?? null
	});
}

export function useTrackQuery(id: () => Id<'track'> | null) {
	return createQuery<TrackDto, ApiError>({
		get queryKey() {
			return queryKeys.track(id() ?? '');
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => {
			const value = id();
			if (!value) throw new Error('track id is required');
			return api<TrackDto>(`/tracks/${value}`);
		},
		get enabled() {
			return !!id();
		}
	});
}

export type CreateTrackInput = {
	file: File;
	title?: string;
	artistNames?: string[];
	album?: string | null;
};

export function useCreateTrackMutation() {
	return createMutation<TrackDto, ApiError, CreateTrackInput>({
		mutationFn: (input) => {
			const fd = new FormData();
			fd.set('file', input.file, input.file.name);
			if (input.title) fd.set('title', input.title);
			for (const artistName of input.artistNames ?? []) fd.append('artistNames', artistName);
			if (input.album) fd.set('album', input.album);
			return api<TrackDto>('/tracks', { method: 'POST', body: fd });
		}
	});
}

export function useFinalizeTrackMutation() {
	const qc = useQueryClient();
	return createMutation<
		TrackDto,
		ApiError,
		{ trackId: Id<'track'>; input: FinalizeTrackInput }
	>({
		mutationFn: ({ trackId, input }) =>
			api<TrackDto>(`/tracks/${trackId}/finalize`, {
				method: 'POST',
				body: input
			}),
		onSuccess: (track) => {
			qc.setQueryData(queryKeys.track(track.id), track);
			void qc.invalidateQueries({ queryKey: queryKeys.tracks });
		}
	});
}

export function useUpdateTrackMutation() {
	const qc = useQueryClient();
	return createMutation<
		TrackDto,
		ApiError,
		{ trackId: Id<'track'>; patch: TrackPatch }
	>({
		mutationFn: ({ trackId, patch }) =>
			api<TrackDto>(`/tracks/${trackId}`, { method: 'PATCH', body: patch }),
		onSuccess: (track) => {
			qc.setQueryData(queryKeys.track(track.id), track);
			void qc.invalidateQueries({ queryKey: queryKeys.tracks });
		}
	});
}

export function useSetLyricsMutation() {
	const qc = useQueryClient();
	return createMutation<
		TrackDto,
		ApiError,
		{ trackId: Id<'track'>; lyricsLrc: string }
	>({
		mutationFn: ({ trackId, lyricsLrc }) =>
			api<TrackDto>(`/tracks/${trackId}/lyrics`, {
				method: 'PUT',
				body: { lyricsLrc }
			}),
		onSuccess: (track) => {
			qc.setQueryData(queryKeys.track(track.id), track);
			void qc.invalidateQueries({ queryKey: queryKeys.tracks });
		}
	});
}

export function useClearLyricsMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, { trackId: Id<'track'> }>({
		mutationFn: ({ trackId }) =>
			api<void>(`/tracks/${trackId}/lyrics`, { method: 'DELETE' }),
		onSuccess: (_, { trackId }) => {
			void qc.invalidateQueries({ queryKey: queryKeys.track(trackId) });
			void qc.invalidateQueries({ queryKey: queryKeys.tracks });
		}
	});
}

export function useDeleteTrackMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, { trackId: Id<'track'> }>({
		mutationFn: ({ trackId }) =>
			api<void>(`/tracks/${trackId}`, { method: 'DELETE' }),
		onSuccess: (_, { trackId }) => {
			qc.removeQueries({ queryKey: queryKeys.track(trackId) });
			void qc.invalidateQueries({ queryKey: queryKeys.tracks });
		}
	});
}
