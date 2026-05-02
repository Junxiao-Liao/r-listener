import {
	createMutation,
	createQuery,
	useQueryClient,
	type CreateQueryResult
} from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { suppressGlobalApiErrorToast } from '$shared/feedback/error-toast.service';
import { queryKeys } from '$shared/query/keys';
import type { Id, QueueStateDto } from '$shared/types/dto';

export function useQueueQuery(enabled: () => boolean = () => true): CreateQueryResult<QueueStateDto, ApiError> {
	return createQuery<QueueStateDto, ApiError>({
		queryKey: queryKeys.queue,
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<QueueStateDto>('/queue'),
		get enabled() {
			return enabled();
		}
	});
}

export type AddQueueItemsInput = {
	trackIds: Id<'track'>[];
	position?: number | null;
};

export function useAddQueueItemsMutation() {
	const qc = useQueryClient();
	return createMutation<QueueStateDto, ApiError, AddQueueItemsInput>({
		mutationFn: (input) =>
			api<QueueStateDto>('/queue/items', {
				method: 'POST',
				body: { trackIds: input.trackIds, position: input.position ?? null }
			}),
		onSuccess: (state) => {
			qc.setQueryData(queryKeys.queue, state);
		}
	});
}

export type UpdateQueueItemInput = {
	itemId: Id<'queue_item'>;
	position?: number;
	isCurrent?: boolean;
};

export function useUpdateQueueItemMutation() {
	const qc = useQueryClient();
	return createMutation<QueueStateDto, ApiError, UpdateQueueItemInput>({
		mutationFn: ({ itemId, ...patch }) =>
			api<QueueStateDto>(`/queue/items/${itemId}`, {
				method: 'PATCH',
				body: patch
			}),
		onSuccess: (state) => {
			qc.setQueryData(queryKeys.queue, state);
		}
	});
}

export function useDeleteQueueItemMutation() {
	const qc = useQueryClient();
	return createMutation<QueueStateDto, ApiError, { itemId: Id<'queue_item'> }>({
		mutationFn: ({ itemId }) =>
			api<QueueStateDto>(`/queue/items/${itemId}`, { method: 'DELETE' }),
		onSuccess: (state) => {
			qc.setQueryData(queryKeys.queue, state);
		}
	});
}

export function useShuffleQueueMutation() {
	const qc = useQueryClient();
	return createMutation<QueueStateDto, ApiError, void>({
		mutationFn: () =>
			api<QueueStateDto>('/queue/shuffle', { method: 'POST' }),
		onSuccess: (state) => {
			qc.setQueryData(queryKeys.queue, state);
		}
	});
}

export function useClearQueueMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, void>({
		mutationFn: () => api<void>('/queue', { method: 'DELETE' }),
		onSuccess: () => {
			qc.setQueryData(queryKeys.queue, {
				items: [],
				currentItemId: null,
				updatedAt: null
			} satisfies QueueStateDto);
		}
	});
}
