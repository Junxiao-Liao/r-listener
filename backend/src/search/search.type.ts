import type { PlaylistDto } from '../playlists/playlists.type';
import type { TrackDto } from '../tracks/tracks.type';

export type SearchKind = 'track' | 'playlist';

export type SearchHitDto =
	| { kind: 'track'; track: TrackDto }
	| { kind: 'playlist'; playlist: PlaylistDto };

export type SearchResultDto = {
	items: SearchHitDto[];
	nextCursor: string | null;
};
