import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { tracks } from '../tracks/tracks.orm';
import type { TrackStatus } from '../tracks/tracks.type';
import { queueItems } from './queue.orm';
import type { QueueItemRow, QueueItemWithTrack, TrackRow } from './queue.dto';

export type ListItemsInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
};

export type FindItemInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	itemId: Id<'queue_item'>;
};

export type InsertManyInput = {
	items: Array<{
		id: Id<'queue_item'>;
		userId: Id<'user'>;
		tenantId: Id<'tenant'>;
		trackId: Id<'track'>;
		positionFrac: number;
		isCurrent: boolean;
		addedAt: Date;
		updatedAt: Date;
	}>;
};

export type SetPositionsInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	updates: Array<{ id: Id<'queue_item'>; positionFrac: number }>;
	now: Date;
};

export type UpdateItemInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	itemId: Id<'queue_item'>;
	set: { positionFrac?: number; isCurrent?: boolean };
	now: Date;
};

export type ClearCurrentInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	exceptItemId: Id<'queue_item'> | null;
	now: Date;
};

export type SoftDeleteItemInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	itemId: Id<'queue_item'>;
	now: Date;
};

export type SoftDeleteAllInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	now: Date;
};

export type QueueRepository = {
	listItemsWithTracks(input: ListItemsInput): Promise<QueueItemWithTrack[]>;
	findItem(input: FindItemInput): Promise<QueueItemRow | null>;
	findTrack(trackId: Id<'track'>, tenantId: Id<'tenant'>): Promise<TrackRow | null>;
	insertManyItems(input: InsertManyInput): Promise<void>;
	setPositions(input: SetPositionsInput): Promise<void>;
	updateItem(input: UpdateItemInput): Promise<QueueItemRow | null>;
	clearCurrent(input: ClearCurrentInput): Promise<void>;
	softDeleteItem(input: SoftDeleteItemInput): Promise<QueueItemRow | null>;
	softDeleteAll(input: SoftDeleteAllInput): Promise<void>;
};

export function createQueueRepository(db: Db): QueueRepository {
	return {
		listItemsWithTracks: async (input) => {
			const rows = await db
				.select()
				.from(queueItems)
				.innerJoin(tracks, eq(tracks.id, queueItems.trackId))
				.where(
					and(
						eq(queueItems.userId, input.userId),
						eq(queueItems.tenantId, input.tenantId),
						isNull(queueItems.deletedAt),
						eq(tracks.status, 'ready' satisfies TrackStatus),
						isNull(tracks.deletedAt)
					)
				)
				.orderBy(asc(queueItems.positionFrac), asc(queueItems.id));

			const result = rows.map((r) => ({
				row: r.queue_items as QueueItemRow,
				track: r.tracks as TrackRow
			}));
			return result;
		},

		findItem: async (input) => {
			const rows = await db
				.select()
				.from(queueItems)
				.where(
					and(
						eq(queueItems.id, input.itemId),
						eq(queueItems.userId, input.userId),
						eq(queueItems.tenantId, input.tenantId),
						isNull(queueItems.deletedAt)
					)
				)
				.limit(1);
			return rows[0] ?? null;
		},

		findTrack: async (trackId, tenantId) => {
			const rows = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)))
				.limit(1);
			return rows[0] ?? null;
		},

		insertManyItems: async (input) => {
			if (input.items.length === 0) return;

			const rows = input.items.map((i) => ({
				id: i.id,
				userId: i.userId,
				tenantId: i.tenantId,
				trackId: i.trackId,
				positionFrac: i.positionFrac,
				isCurrent: i.isCurrent,
				addedAt: i.addedAt,
				updatedAt: i.updatedAt
			}));

			// D1 has a 100 bound-parameter limit; each row has 8 columns => max 12 rows per batch.
			const BATCH_SIZE = 10;
			for (let i = 0; i < rows.length; i += BATCH_SIZE) {
				await db.insert(queueItems).values(rows.slice(i, i + BATCH_SIZE));
			}
		},

		setPositions: async (input) => {
			if (input.updates.length === 0) return;
			for (const u of input.updates) {
				await db
					.update(queueItems)
					.set({ positionFrac: u.positionFrac, updatedAt: input.now })
					.where(
						and(
							eq(queueItems.id, u.id),
							eq(queueItems.userId, input.userId),
							eq(queueItems.tenantId, input.tenantId),
							isNull(queueItems.deletedAt)
						)
					);
			}
		},

		updateItem: async (input) => {
			const set: Record<string, unknown> = { updatedAt: input.now };
			if (input.set.positionFrac !== undefined) set.positionFrac = input.set.positionFrac;
			if (input.set.isCurrent !== undefined) set.isCurrent = input.set.isCurrent;

			await db
				.update(queueItems)
				.set(set as never)
				.where(
					and(
						eq(queueItems.id, input.itemId),
						eq(queueItems.userId, input.userId),
						eq(queueItems.tenantId, input.tenantId),
						isNull(queueItems.deletedAt)
					)
				);

			const rows = await db
				.select()
				.from(queueItems)
				.where(eq(queueItems.id, input.itemId))
				.limit(1);
			return rows[0] ?? null;
		},

		clearCurrent: async (input) => {
			const conditions = [
				eq(queueItems.userId, input.userId),
				eq(queueItems.tenantId, input.tenantId),
				eq(queueItems.isCurrent, true),
				isNull(queueItems.deletedAt)
			];
			if (input.exceptItemId) {
				conditions.push(ne(queueItems.id, input.exceptItemId));
			}

			await db
				.update(queueItems)
				.set({ isCurrent: false, updatedAt: input.now })
				.where(and(...conditions));
		},

		softDeleteItem: async (input) => {
			const rows = await db
				.update(queueItems)
				.set({ deletedAt: input.now, updatedAt: input.now })
				.where(
					and(
						eq(queueItems.id, input.itemId),
						eq(queueItems.userId, input.userId),
						eq(queueItems.tenantId, input.tenantId),
						isNull(queueItems.deletedAt)
					)
				)
				.returning();
			return rows[0] ?? null;
		},

		softDeleteAll: async (input) => {
			await db
				.update(queueItems)
				.set({ deletedAt: input.now, updatedAt: input.now, isCurrent: false })
				.where(
					and(
						eq(queueItems.userId, input.userId),
						eq(queueItems.tenantId, input.tenantId),
						isNull(queueItems.deletedAt)
				)
				);
		}
	};
}

// re-export so other files don't have to dig into orm imports
export { queueItems, tracks, inArray, sql };
