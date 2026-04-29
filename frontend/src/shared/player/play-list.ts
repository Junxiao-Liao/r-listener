import { useQueryClient } from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { queryKeys } from '$shared/query/keys';
import { createMutation } from '@tanstack/svelte-query';
import type { Id, QueueStateDto, TrackDto } from '$shared/types/dto';

export type PlayListInput = {
	tracks: TrackDto[];
	startTrackId: Id<'track'>;
};

/**
 * Replace the queue with the given tracks and mark the chosen track as current.
 * Used by Library/Search/Playlist tap-to-play flow.
 */
export function usePlayListMutation() {
	const qc = useQueryClient();
	return createMutation<QueueStateDto, ApiError, PlayListInput>({
		mutationFn: async ({ tracks, startTrackId }) => {
			const trackIds = tracks.map((t) => t.id);
			await api<void>('/queue', { method: 'DELETE' });
			const created = await api<QueueStateDto>('/queue/items', {
				method: 'POST',
				body: { trackIds, position: null }
			});
			const targetItem = created.items.find((i) => i.trackId === startTrackId);
			if (!targetItem) return created;
			return api<QueueStateDto>(`/queue/items/${targetItem.id}`, {
				method: 'PATCH',
				body: { isCurrent: true }
			});
		},
		onSuccess: (state) => {
			qc.setQueryData(queryKeys.queue, state);
		}
	});
}
