import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { Id, Iso8601 } from '../shared/shared.type';
import type { TrackDto } from '../tracks/tracks.type';
import { toTrackDto } from '../tracks/tracks.dto';
import type { tracks } from '../tracks/tracks.orm';
import type { playbackHistory } from './playback.orm';
import type { RecentTrackDto } from './playback.type';

export const playbackEventSchema = z.object({
	trackId: z.string().min(1),
	startedAt: z.iso.datetime(),
	positionMs: z.number().int().nonnegative(),
	event: z.enum(['play', 'progress', 'ended']),
	playlistId: z.string().min(1).nullable()
});

export const playbackEventsBatchSchema = z.object({
	events: z.array(playbackEventSchema).min(1).max(50)
});

export type PlaybackEventsBatchInput = z.infer<typeof playbackEventsBatchSchema>;

export const recentTracksQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).default(20),
	cursor: z.string().optional()
});

export type RecentTracksQuery = z.infer<typeof recentTracksQuerySchema>;

export const continueListeningQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(20).default(10)
});

export type ContinueListeningQuery = z.infer<typeof continueListeningQuerySchema>;

export type RecentTrackJoinedRow = {
	playback: typeof playbackHistory.$inferSelect;
	track: typeof tracks.$inferSelect;
};

export function toRecentTrackDto(row: RecentTrackJoinedRow): RecentTrackDto {
	const trackDto: TrackDto = toTrackDto(row.track, null);
	return {
		track: trackDto,
		lastPlayedAt: fromUnixTimestampSeconds(row.playback.lastPlayedAt),
		lastPositionMs: row.playback.lastPositionMs,
		playlistId: (row.playback.lastPlaylistId as Id<'playlist'> | null) ?? null
	};
}

export function encodeRecentCursor(lastPlayedAt: Iso8601, trackId: Id<'track'>): string {
	return btoa(JSON.stringify({ t: lastPlayedAt, id: trackId }));
}

export function decodeRecentCursor(cursor: string): { lastPlayedAt: Iso8601; trackId: Id<'track'> } {
	const data = JSON.parse(atob(cursor)) as { t: string; id: string };
	return { lastPlayedAt: data.t as Iso8601, trackId: data.id as Id<'track'> };
}
