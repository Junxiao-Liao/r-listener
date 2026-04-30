import {
	createMutation,
	createQuery,
	useQueryClient,
	type CreateQueryResult
} from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { suppressGlobalApiErrorToast } from '$shared/feedback/error-toast.service';
import { queryKeys } from '$shared/query/keys';
import type {
	AddPlaylistTrackInput,
	CreatePlaylistInput,
	Id,
	PlaylistDto,
	PlaylistListResponse,
	PlaylistSort,
	PlaylistTrackDto,
	PlaylistTrackListResponse,
	UpdatePlaylistInput
} from '$shared/types/dto';

export type PlaylistsQueryParams = {
	sort?: PlaylistSort;
	q?: string;
};

export function usePlaylistsQuery(
	params: () => PlaylistsQueryParams = () => ({})
): CreateQueryResult<PlaylistListResponse, ApiError> {
	return createQuery<PlaylistListResponse, ApiError>({
		get queryKey() {
			const p = params();
			return queryKeys.playlistsList({
				sort: p.sort ?? 'createdAt:desc',
				q: p.q
			});
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => {
			const p = params();
			const search = new URLSearchParams();
			if (p.sort) search.set('sort', p.sort);
			if (p.q) search.set('q', p.q);
			const qs = search.toString();
			return api<PlaylistListResponse>(`/playlists${qs ? `?${qs}` : ''}`);
		}
	});
}

export function usePlaylistQuery(
	id: () => Id<'playlist'> | null,
	enabled: () => boolean = () => true
): CreateQueryResult<PlaylistDto, ApiError> {
	return createQuery<PlaylistDto, ApiError>({
		get queryKey() {
			return queryKeys.playlist(id() ?? '');
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<PlaylistDto>(`/playlists/${id()}`),
		get enabled() {
			return enabled() && id() !== null;
		}
	});
}

export function usePlaylistTracksQuery(
	id: () => Id<'playlist'> | null,
	enabled: () => boolean = () => true
): CreateQueryResult<PlaylistTrackListResponse, ApiError> {
	return createQuery<PlaylistTrackListResponse, ApiError>({
		get queryKey() {
			return queryKeys.playlistTracks(id() ?? '');
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<PlaylistTrackListResponse>(`/playlists/${id()}/tracks`),
		get enabled() {
			return enabled() && id() !== null;
		}
	});
}

export function useCreatePlaylistMutation() {
	const qc = useQueryClient();
	return createMutation<PlaylistDto, ApiError, CreatePlaylistInput>({
		mutationFn: (input) =>
			api<PlaylistDto>('/playlists', { method: 'POST', body: input }),
		meta: suppressGlobalApiErrorToast,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.playlists });
		}
	});
}

export function useUpdatePlaylistMutation(id: Id<'playlist'>) {
	const qc = useQueryClient();
	return createMutation<PlaylistDto, ApiError, UpdatePlaylistInput>({
		mutationFn: (input) =>
			api<PlaylistDto>(`/playlists/${id}`, { method: 'PATCH', body: input }),
		meta: suppressGlobalApiErrorToast,
		onSuccess: (data) => {
			qc.setQueryData(queryKeys.playlist(id), data);
			qc.invalidateQueries({ queryKey: queryKeys.playlists });
		}
	});
}

export function useDeletePlaylistMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, { id: Id<'playlist'> }>({
		mutationFn: ({ id }) => api<void>(`/playlists/${id}`, { method: 'DELETE' }),
		onSuccess: (_, { id }) => {
			qc.removeQueries({ queryKey: queryKeys.playlist(id) });
			qc.removeQueries({ queryKey: queryKeys.playlistTracks(id) });
			qc.invalidateQueries({ queryKey: queryKeys.playlists });
		}
	});
}

export function useAddPlaylistTrackMutation(playlistId: Id<'playlist'>) {
	const qc = useQueryClient();
	return createMutation<PlaylistTrackDto, ApiError, AddPlaylistTrackInput>({
		mutationFn: (input) =>
			api<PlaylistTrackDto>(`/playlists/${playlistId}/tracks`, {
				method: 'POST',
				body: input
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.playlist(playlistId) });
			qc.invalidateQueries({ queryKey: queryKeys.playlistTracks(playlistId) });
			qc.invalidateQueries({ queryKey: queryKeys.playlists });
		}
	});
}

export function useMovePlaylistTrackMutation(playlistId: Id<'playlist'>) {
	const qc = useQueryClient();
	return createMutation<
		PlaylistTrackDto,
		ApiError,
		{ trackId: Id<'track'>; position: number }
	>({
		mutationFn: ({ trackId, position }) =>
			api<PlaylistTrackDto>(`/playlists/${playlistId}/tracks/${trackId}`, {
				method: 'PATCH',
				body: { position }
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.playlistTracks(playlistId) });
		}
	});
}

export function useRemovePlaylistTrackMutation(playlistId: Id<'playlist'>) {
	const qc = useQueryClient();
	return createMutation<void, ApiError, { trackId: Id<'track'> }>({
		mutationFn: ({ trackId }) =>
			api<void>(`/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.playlist(playlistId) });
			qc.invalidateQueries({ queryKey: queryKeys.playlistTracks(playlistId) });
			qc.invalidateQueries({ queryKey: queryKeys.playlists });
		}
	});
}
