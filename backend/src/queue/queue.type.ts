import type { Id, Iso8601 } from '../shared/shared.type';
import type { TrackDto } from '../tracks/tracks.type';

export type QueueItemDto = {
	id: Id<'queue_item'>;
	tenantId: Id<'tenant'>;
	userId: Id<'user'>;
	trackId: Id<'track'>;
	position: number;
	isCurrent: boolean;
	addedAt: Iso8601;
	updatedAt: Iso8601;
	track: TrackDto;
};

export type QueueStateDto = {
	items: QueueItemDto[];
	currentItemId: Id<'queue_item'> | null;
	updatedAt: Iso8601 | null;
};
