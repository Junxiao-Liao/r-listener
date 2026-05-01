import type { Id } from '../shared/shared.type';
import type { TrackDto } from '../tracks/tracks.type';

export type ArtistDto = {
	id: Id<'artist'>;
	name: string;
};

export type ListArtistsResult = {
	items: ArtistDto[];
	nextCursor: string | null;
};

export type ArtistAggregateDto = ArtistDto & {
	trackCount: number;
	totalDurationMs: number;
};

export type ArtistTrackListResult = {
	items: TrackDto[];
};
