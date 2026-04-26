import type { PlaylistDto } from '../playlists/playlists.type';
import type { TrackDto } from '../tracks/tracks.type';

export type SearchHitDto =
	| { kind: 'track'; track: TrackDto }
	| { kind: 'playlist'; playlist: PlaylistDto };
