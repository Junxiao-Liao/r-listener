import { describe, expect, it } from 'vitest';
import type { Id } from '../shared/shared.type';
import type { TrackStatus } from '../tracks/tracks.type';
import { createQueueService } from './queue.service';
import type { QueueItemRow, TrackRow } from './queue.dto';
import type {
	QueueRepository,
	InsertManyInput,
	UpdateItemInput,
	SetPositionsInput
} from './queue.repository';

const FIXED_NOW = new Date('2026-04-29T12:00:00.000Z');

describe('queue service', () => {
	describe('addItems', () => {
		it('appends a single ready track to an empty queue at position 1', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a')]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			const state = await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a')],
				position: null
			});

			expect(state.items).toHaveLength(1);
			expect(state.items[0]!.trackId).toBe('trk_a');
			expect(state.items[0]!.position).toBe(1);
			expect(state.currentItemId).toBeNull();
		});

		it('appends multiple tracks at end with dense positions', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b'), readyTrack('trk_c')]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			const state = await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a'), tkid('trk_b'), tkid('trk_c')],
				position: null
			});

			expect(state.items.map((i) => i.trackId)).toEqual(['trk_a', 'trk_b', 'trk_c']);
			expect(state.items.map((i) => i.position)).toEqual([1, 2, 3]);
		});

		it('inserts at position 2 and shifts existing items down', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b'), readyTrack('trk_inserted')]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a'), tkid('trk_b')],
				position: null
			});

			const state = await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_inserted')],
				position: 2
			});

			expect(state.items.map((i) => i.trackId)).toEqual(['trk_a', 'trk_inserted', 'trk_b']);
			expect(state.items.map((i) => i.position)).toEqual([1, 2, 3]);
		});

		it('rejects unknown track with 404 track_not_found', async () => {
			const repo = createFakeRepo({ tracks: [] });
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			await expect(
				service.addItems({
					userId: uid('usr_a'),
					tenantId: tid('tnt_a'),
					trackIds: [tkid('trk_missing')],
					position: null
				})
			).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
		});

		it('rejects pending track with 409 track_not_ready', async () => {
			const repo = createFakeRepo({ tracks: [pendingTrack('trk_p')] });
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			await expect(
				service.addItems({
					userId: uid('usr_a'),
					tenantId: tid('tnt_a'),
					trackIds: [tkid('trk_p')],
					position: null
				})
			).rejects.toMatchObject({ status: 409, code: 'track_not_ready' });
		});

		it('rejects wrong-tenant track with 404 track_not_found', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a', { tenantId: 'tnt_other' })]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			await expect(
				service.addItems({
					userId: uid('usr_a'),
					tenantId: tid('tnt_a'),
					trackIds: [tkid('trk_a')],
					position: null
				})
			).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
		});
	});

	describe('updateItem isCurrent', () => {
		it('setting isCurrent true clears sibling current marks', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b')]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			const initial = await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a'), tkid('trk_b')],
				position: null
			});

			const firstId = initial.items[0]!.id;
			const secondId = initial.items[1]!.id;

			await service.updateItem({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				itemId: firstId,
				isCurrent: true
			});

			const after = await service.updateItem({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				itemId: secondId,
				isCurrent: true
			});

			expect(after.currentItemId).toBe(secondId);
			expect(after.items.find((i) => i.id === firstId)!.isCurrent).toBe(false);
			expect(after.items.find((i) => i.id === secondId)!.isCurrent).toBe(true);
		});

		it('setting isCurrent false clears that item only', async () => {
			const repo = createFakeRepo({ tracks: [readyTrack('trk_a')] });
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			const initial = await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a')],
				position: null
			});

			await service.updateItem({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				itemId: initial.items[0]!.id,
				isCurrent: true
			});

			const cleared = await service.updateItem({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				itemId: initial.items[0]!.id,
				isCurrent: false
			});

			expect(cleared.currentItemId).toBeNull();
		});
	});

	describe('updateItem position', () => {
		it('reorders to target position with dense positions', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b'), readyTrack('trk_c')]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			const initial = await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a'), tkid('trk_b'), tkid('trk_c')],
				position: null
			});

			// Move trk_c (third) to position 1
			const moved = await service.updateItem({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				itemId: initial.items[2]!.id,
				position: 1
			});

			expect(moved.items.map((i) => i.trackId)).toEqual(['trk_c', 'trk_a', 'trk_b']);
			expect(moved.items.map((i) => i.position)).toEqual([1, 2, 3]);
		});

		it('rejects unknown queue item with 404 queue_item_not_found', async () => {
			const repo = createFakeRepo({ tracks: [] });
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			await expect(
				service.updateItem({
					userId: uid('usr_a'),
					tenantId: tid('tnt_a'),
					itemId: 'qi_missing' as Id<'queue_item'>,
					position: 1
				})
			).rejects.toMatchObject({ status: 404, code: 'queue_item_not_found' });
		});
	});

	describe('deleteItem', () => {
		it('removes one item and compacts remaining positions', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b'), readyTrack('trk_c')]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			const initial = await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a'), tkid('trk_b'), tkid('trk_c')],
				position: null
			});

			const after = await service.deleteItem({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				itemId: initial.items[1]!.id
			});

			expect(after.items.map((i) => i.trackId)).toEqual(['trk_a', 'trk_c']);
			expect(after.items.map((i) => i.position)).toEqual([1, 2]);
		});

		it('clears currentItemId when removed item was current', async () => {
			const repo = createFakeRepo({ tracks: [readyTrack('trk_a')] });
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			const initial = await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a')],
				position: null
			});

			await service.updateItem({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				itemId: initial.items[0]!.id,
				isCurrent: true
			});

			const after = await service.deleteItem({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				itemId: initial.items[0]!.id
			});

			expect(after.currentItemId).toBeNull();
		});

		it('rejects unknown queue item with 404 queue_item_not_found', async () => {
			const repo = createFakeRepo({ tracks: [] });
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			await expect(
				service.deleteItem({
					userId: uid('usr_a'),
					tenantId: tid('tnt_a'),
					itemId: 'qi_missing' as Id<'queue_item'>
				})
			).rejects.toMatchObject({ status: 404, code: 'queue_item_not_found' });
		});
	});

	describe('clearQueue', () => {
		it('soft-deletes every item for that user+tenant', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b')]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a'), tkid('trk_b')],
				position: null
			});

			await service.clearQueue({ userId: uid('usr_a'), tenantId: tid('tnt_a') });

			const state = await service.getState({ userId: uid('usr_a'), tenantId: tid('tnt_a') });
			expect(state.items).toEqual([]);
			expect(state.currentItemId).toBeNull();
		});
	});

	describe('tenant scoping', () => {
		it('queue items are not visible from another tenant', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_a2', { tenantId: 'tnt_other' })]
			});
			const service = createQueueService({ queueRepository: repo, now: () => FIXED_NOW });

			await service.addItems({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				trackIds: [tkid('trk_a')],
				position: null
			});

			const otherTenantState = await service.getState({
				userId: uid('usr_a'),
				tenantId: tid('tnt_other')
			});
			expect(otherTenantState.items).toEqual([]);
		});
	});
});

type FakeRepoOptions = {
	tracks: TrackRow[];
};

function createFakeRepo(options: FakeRepoOptions): QueueRepository {
	const items: QueueItemRow[] = [];
	const tracksMap = new Map<string, TrackRow>();
	for (const t of options.tracks) tracksMap.set(`${t.tenantId}:${t.id}`, t);

	function trackKey(trackId: string, tenantId: string) {
		return `${tenantId}:${trackId}`;
	}

	return {
		listItemsWithTracks: async ({ userId, tenantId }) => {
			return items
				.filter(
					(i) => i.userId === userId && i.tenantId === tenantId && i.deletedAt === null
				)
				.sort((a, b) => a.positionFrac - b.positionFrac)
				.map((row) => ({
					row,
					track: tracksMap.get(trackKey(row.trackId, row.tenantId))!
				}));
		},

		findItem: async ({ userId, tenantId, itemId }) => {
			return (
				items.find(
					(i) =>
						i.id === itemId &&
						i.userId === userId &&
						i.tenantId === tenantId &&
						i.deletedAt === null
				) ?? null
			);
		},

		findTrack: async (trackId, tenantId) => {
			return tracksMap.get(trackKey(trackId, tenantId)) ?? null;
		},

		insertManyItems: async ({ items: toInsert }: InsertManyInput) => {
			for (const i of toInsert) {
				items.push({
					id: i.id,
					userId: i.userId,
					tenantId: i.tenantId,
					trackId: i.trackId,
					positionFrac: i.positionFrac,
					isCurrent: i.isCurrent,
					addedAt: i.addedAt,
					updatedAt: i.updatedAt,
					deletedAt: null
				});
			}
		},

		setPositions: async ({ userId, tenantId, updates, now }: SetPositionsInput) => {
			for (const u of updates) {
				const target = items.find(
					(i) =>
						i.id === u.id &&
						i.userId === userId &&
						i.tenantId === tenantId &&
						i.deletedAt === null
				);
				if (target) {
					target.positionFrac = u.positionFrac;
					target.updatedAt = now;
				}
			}
		},

		updateItem: async ({ userId, tenantId, itemId, set, now }: UpdateItemInput) => {
			const target = items.find(
				(i) =>
					i.id === itemId &&
					i.userId === userId &&
					i.tenantId === tenantId &&
					i.deletedAt === null
			);
			if (!target) return null;
			if (set.positionFrac !== undefined) target.positionFrac = set.positionFrac;
			if (set.isCurrent !== undefined) target.isCurrent = set.isCurrent;
			target.updatedAt = now;
			return target;
		},

		clearCurrent: async ({ userId, tenantId, exceptItemId, now }) => {
			for (const i of items) {
				if (
					i.userId === userId &&
					i.tenantId === tenantId &&
					i.deletedAt === null &&
					i.isCurrent &&
					(exceptItemId === null || i.id !== exceptItemId)
				) {
					i.isCurrent = false;
					i.updatedAt = now;
				}
			}
		},

		softDeleteItem: async ({ userId, tenantId, itemId, now }) => {
			const target = items.find(
				(i) =>
					i.id === itemId &&
					i.userId === userId &&
					i.tenantId === tenantId &&
					i.deletedAt === null
			);
			if (!target) return null;
			target.deletedAt = now;
			target.updatedAt = now;
			return target;
		},

		softDeleteAll: async ({ userId, tenantId, now }) => {
			for (const i of items) {
				if (i.userId === userId && i.tenantId === tenantId && i.deletedAt === null) {
					i.deletedAt = now;
					i.updatedAt = now;
					i.isCurrent = false;
				}
			}
		}
	};
}

function readyTrack(id: string, opts: { tenantId?: string } = {}): TrackRow {
	return makeTrackRow(id, opts.tenantId ?? 'tnt_a', 'ready');
}

function pendingTrack(id: string, opts: { tenantId?: string } = {}): TrackRow {
	return makeTrackRow(id, opts.tenantId ?? 'tnt_a', 'pending');
}

function makeTrackRow(id: string, tenantId: string, status: TrackStatus): TrackRow {
	return {
		id,
		tenantId,
		uploaderId: 'usr_a',
		title: id,
		artist: null,
		album: null,
		durationMs: 180000,
		contentType: 'audio/mpeg',
		sizeBytes: 1024,
		trackNumber: null,
		genre: null,
		year: null,
		lyricsLrc: null,
		lyricsStatus: 'none',
		audioR2Key: `tenants/${tenantId}/tracks/${id}.mp3`,
		coverR2Key: null,
		status,
		createdAt: new Date('2026-04-26T00:00:00.000Z'),
		updatedAt: new Date('2026-04-26T00:00:00.000Z'),
		deletedAt: null
	};
}

function uid(value: string): Id<'user'> {
	return value as Id<'user'>;
}
function tid(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}
function tkid(value: string): Id<'track'> {
	return value as Id<'track'>;
}
