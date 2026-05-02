import type { Db } from '../db';
import { apiError } from '../http/api-error';
import { createId } from '../shared/id';
import type { Id } from '../shared/shared.type';
import type { TrackStatus } from '../tracks/tracks.type';
import { buildQueueState } from './queue.dto';
import { createQueueRepository, type QueueRepository } from './queue.repository';
import type { QueueStateDto } from './queue.type';

export type ScopedInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
};

export type AddItemsServiceInput = ScopedInput & {
	trackIds: Id<'track'>[];
	position: number | null;
};

export type UpdateItemServiceInput = ScopedInput & {
	itemId: Id<'queue_item'>;
	position?: number;
	isCurrent?: boolean;
};

export type DeleteItemServiceInput = ScopedInput & {
	itemId: Id<'queue_item'>;
};

export type QueueService = {
	getState(input: ScopedInput): Promise<QueueStateDto>;
	addItems(input: AddItemsServiceInput): Promise<QueueStateDto>;
	updateItem(input: UpdateItemServiceInput): Promise<QueueStateDto>;
	shuffleQueue(input: ScopedInput): Promise<QueueStateDto>;
	deleteItem(input: DeleteItemServiceInput): Promise<QueueStateDto>;
	clearQueue(input: ScopedInput): Promise<void>;
};

export type QueueServiceDependencies = {
	queueRepository: QueueRepository;
	now?: () => Date;
};

export function createQueueService(deps: QueueServiceDependencies): QueueService {
	const now = deps.now ?? (() => new Date());

	async function loadState(input: ScopedInput): Promise<QueueStateDto> {
		const rows = await deps.queueRepository.listItemsWithTracks(input);
		return buildQueueState(rows);
	}

	async function renumberDense(input: ScopedInput, stamp: Date) {
		const rows = await deps.queueRepository.listItemsWithTracks(input);
		await deps.queueRepository.setPositions({
			userId: input.userId,
			tenantId: input.tenantId,
			updates: rows.map((r, i) => ({
				id: r.row.id as Id<'queue_item'>,
				positionFrac: i + 1
			})),
			now: stamp
		});
	}

	return {
		getState: (input) => loadState(input),

		addItems: async (input) => {
			if (input.trackIds.length === 0) {
				throw apiError(400, 'validation_failed', 'At least one trackId is required.');
			}

			// Validate every track up-front
			for (const trackId of input.trackIds) {
				const track = await deps.queueRepository.findTrack(trackId, input.tenantId);
				if (!track) throw apiError(404, 'track_not_found', 'Track not found.');
				if ((track.status as TrackStatus) !== 'ready') {
					throw apiError(409, 'track_not_ready', 'Track is not ready to be queued.');
				}
			}

			const stamp = now();
			const existing = await deps.queueRepository.listItemsWithTracks(input);

			// Compute insertion index (0-based)
			const insertAt =
				input.position === null || input.position === undefined
					? existing.length
					: Math.max(0, Math.min(existing.length, input.position - 1));

			const newItems = input.trackIds.map((trackId, j) => ({
				id: createId('qi_') as Id<'queue_item'>,
				userId: input.userId,
				tenantId: input.tenantId,
				trackId,
				positionFrac: insertAt + j + 0.5, // provisional; renumber will tighten
				isCurrent: false,
				addedAt: stamp,
				updatedAt: stamp
			}));

			await deps.queueRepository.insertManyItems({ items: newItems });
			await renumberDense(input, stamp);
			return loadState(input);
		},

		updateItem: async (input) => {
			const item = await deps.queueRepository.findItem({
				userId: input.userId,
				tenantId: input.tenantId,
				itemId: input.itemId
			});
			if (!item) {
				throw apiError(404, 'queue_item_not_found', 'Queue item not found.');
			}

			const stamp = now();

			if (input.isCurrent !== undefined) {
				if (input.isCurrent) {
					// Clear other items first, then set this one
					await deps.queueRepository.clearCurrent({
						userId: input.userId,
						tenantId: input.tenantId,
						exceptItemId: input.itemId,
						now: stamp
					});
					await deps.queueRepository.updateItem({
						userId: input.userId,
						tenantId: input.tenantId,
						itemId: input.itemId,
						set: { isCurrent: true },
						now: stamp
					});
				} else {
					await deps.queueRepository.updateItem({
						userId: input.userId,
						tenantId: input.tenantId,
						itemId: input.itemId,
						set: { isCurrent: false },
						now: stamp
					});
				}
			}

			if (input.position !== undefined) {
				const existing = await deps.queueRepository.listItemsWithTracks({
					userId: input.userId,
					tenantId: input.tenantId
				});
				const others = existing.filter((r) => r.row.id !== input.itemId);
				const target = Math.max(1, Math.min(others.length + 1, input.position));
				const targetIdx = target - 1;

				// Move this item to targetIdx in the others list
				// Build new full ordering
				const orderedIds = [
					...others.slice(0, targetIdx).map((r) => r.row.id as Id<'queue_item'>),
					input.itemId,
					...others.slice(targetIdx).map((r) => r.row.id as Id<'queue_item'>)
				];

				await deps.queueRepository.setPositions({
					userId: input.userId,
					tenantId: input.tenantId,
					updates: orderedIds.map((id, i) => ({ id, positionFrac: i + 1 })),
					now: stamp
				});
			}

			return loadState(input);
		},

		shuffleQueue: async (input) => {
			const stamp = now();
			const rows = await deps.queueRepository.listItemsWithTracks(input);
			if (rows.length <= 1) return loadState(input);

			const ids = rows.map((r) => r.row.id);
			for (let i = ids.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[ids[i], ids[j]] = [ids[j]!, ids[i]!];
			}

			await deps.queueRepository.setPositions({
				userId: input.userId,
				tenantId: input.tenantId,
				updates: ids.map((id, i) => ({
					id: id as Id<'queue_item'>,
					positionFrac: i + 1
				})),
				now: stamp
			});

			return loadState(input);
		},

		deleteItem: async (input) => {
			const deleted = await deps.queueRepository.softDeleteItem({
				userId: input.userId,
				tenantId: input.tenantId,
				itemId: input.itemId,
				now: now()
			});
			if (!deleted) {
				throw apiError(404, 'queue_item_not_found', 'Queue item not found.');
			}

			await renumberDense(input, now());
			return loadState(input);
		},

		clearQueue: async (input) => {
			await deps.queueRepository.softDeleteAll({
				userId: input.userId,
				tenantId: input.tenantId,
				now: now()
			});
		}
	};
}

export function createQueueServiceForDb(db: Db): QueueService {
	return createQueueService({ queueRepository: createQueueRepository(db) });
}
