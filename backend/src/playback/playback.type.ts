import type { Id, Iso8601 } from '../shared/shared.type';
import type { TrackDto } from '../tracks/tracks.type';

export type PlaybackEvent = 'play' | 'progress' | 'ended';

export type PlaybackEventInput = {
	trackId: Id<'track'>;
	startedAt: Iso8601;
	positionMs: number;
	event: PlaybackEvent;
	playlistId: Id<'playlist'> | null;
};

export type RecentTrackDto = {
	track: TrackDto;
	lastPlayedAt: Iso8601;
	lastPositionMs: number;
	playlistId: Id<'playlist'> | null;
};
