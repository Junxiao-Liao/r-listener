import type { Id, Iso8601 } from '../shared/shared.type';
import type { TrackDto } from '../tracks/tracks.type';

export type PlaylistDto = {
	id: Id<'playlist'>;
	tenantId: Id<'tenant'>;
	name: string;
	description: string | null;
	trackCount: number;
	totalDurationMs: number;
	createdAt: Iso8601;
	updatedAt: Iso8601;
};

export type PlaylistTrackDto = {
	playlistId: Id<'playlist'>;
	trackId: Id<'track'>;
	position: number;
	addedAt: Iso8601;
	track: TrackDto;
};
