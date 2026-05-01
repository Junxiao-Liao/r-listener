import type { Id, Iso8601 } from '../shared/shared.type';
import type { ArtistDto } from '../artists/artists.type';

export type TrackStatus = 'pending' | 'ready';
export type LyricsStatus = 'none' | 'synced' | 'plain' | 'invalid';

export type TrackDto = {
	id: Id<'track'>;
	tenantId: Id<'tenant'>;
	title: string;
	artists: ArtistDto[];
	album: string | null;
	trackNumber: number | null;
	genre: string | null;
	year: number | null;
	durationMs: number | null;
	coverUrl: string | null;
	lyricsLrc: string | null;
	lyricsStatus: LyricsStatus;
	contentType: string;
	sizeBytes: number;
	status: TrackStatus;
	createdAt: Iso8601;
	updatedAt: Iso8601;
};
