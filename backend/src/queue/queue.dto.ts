import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { Id, Iso8601 } from '../shared/shared.type';
import { toTrackDto } from '../tracks/tracks.dto';
import type { tracks } from '../tracks/tracks.orm';
import type { queueItems } from './queue.orm';
import type { QueueItemDto, QueueStateDto } from './queue.type';

export const addQueueItemsInputSchema = z.object({
	trackIds: z.array(z.string().min(1)).min(1).max(100),
	position: z.number().int().positive().nullable().optional()
});

export type AddQueueItemsInput = z.infer<typeof addQueueItemsInputSchema>;

export const updateQueueItemInputSchema = z
	.object({
		position: z.number().int().positive().optional(),
		isCurrent: z.boolean().optional()
	})
	.refine((v) => v.position !== undefined || v.isCurrent !== undefined, {
		message: 'At least one of position or isCurrent must be provided.'
	});

export type UpdateQueueItemInput = z.infer<typeof updateQueueItemInputSchema>;

export type QueueItemRow = typeof queueItems.$inferSelect;
export type TrackRow = typeof tracks.$inferSelect;

export type QueueItemWithTrack = {
	row: QueueItemRow;
	track: TrackRow;
};

export function toQueueItemDto(input: QueueItemWithTrack, position: number): QueueItemDto {
	return {
		id: input.row.id as Id<'queue_item'>,
		tenantId: input.row.tenantId as Id<'tenant'>,
		userId: input.row.userId as Id<'user'>,
		trackId: input.row.trackId as Id<'track'>,
		position,
		isCurrent: input.row.isCurrent,
		addedAt: fromUnixTimestampSeconds(input.row.addedAt),
		updatedAt: fromUnixTimestampSeconds(input.row.updatedAt),
		track: toTrackDto(input.track, null)
	};
}

export function buildQueueState(rows: QueueItemWithTrack[]): QueueStateDto {
	const items = rows.map((r, i) => toQueueItemDto(r, i + 1));
	const currentItem = items.find((i) => i.isCurrent);
	let latestUpdated: Iso8601 | null = null;
	for (const item of items) {
		if (latestUpdated === null || item.updatedAt > latestUpdated) {
			latestUpdated = item.updatedAt;
		}
	}
	return {
		items,
		currentItemId: currentItem?.id ?? null,
		updatedAt: latestUpdated
	};
}
