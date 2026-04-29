import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id, Iso8601 } from '../shared/shared.type';
import { toIso8601 } from '../shared/time';
import { tracks } from '../tracks/tracks.orm';
import type { TrackStatus } from '../tracks/tracks.type';
import { playbackHistory } from './playback.orm';
import {
	decodeRecentCursor,
	encodeRecentCursor,
	toRecentTrackDto,
	type RecentTrackJoinedRow
} from './playback.dto';
import type { RecentTracksPage } from './playback.type';

export type UpsertHistoryInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	trackId: Id<'track'>;
	lastPlayedAt: Date;
	lastPositionMs: number;
	playlistId: Id<'playlist'> | null;
	now: Date;
};

export type ListRecentInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	limit: number;
	cursor?: string | undefined;
};

export type ListContinueListeningInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	limit: number;
};

export type PlaybackRepository = {
	filterVisibleTrackIds(
		trackIds: Id<'track'>[],
		tenantId: Id<'tenant'>
	): Promise<Set<Id<'track'>>>;
	upsertHistory(input: UpsertHistoryInput): Promise<void>;
	listRecent(input: ListRecentInput): Promise<RecentTracksPage>;
	listContinueListening(input: ListContinueListeningInput): Promise<RecentTracksPage>;
};

export function createPlaybackRepository(db: Db): PlaybackRepository {
	return {
		filterVisibleTrackIds: async (trackIds, tenantId) => {
			if (trackIds.length === 0) return new Set();
			const rows = await db
				.select({ id: tracks.id })
				.from(tracks)
				.where(
					and(
						eq(tracks.tenantId, tenantId),
						eq(tracks.status, 'ready' satisfies TrackStatus),
						isNull(tracks.deletedAt)
					)
				);
			const ready = new Set(rows.map((r) => r.id as Id<'track'>));
			return new Set(trackIds.filter((id) => ready.has(id)));
		},

		upsertHistory: async (input) => {
			await db
				.insert(playbackHistory)
				.values({
					userId: input.userId,
					tenantId: input.tenantId,
					trackId: input.trackId,
					lastPlaylistId: input.playlistId,
					lastPlayedAt: input.lastPlayedAt,
					lastPositionMs: input.lastPositionMs,
					updatedAt: input.now
				})
				.onConflictDoUpdate({
					target: [playbackHistory.userId, playbackHistory.tenantId, playbackHistory.trackId],
					set: {
						lastPlayedAt: sql`excluded.last_played_at`,
						lastPositionMs: sql`excluded.last_position_ms`,
						lastPlaylistId: sql`excluded.last_playlist_id`,
						updatedAt: sql`excluded.updated_at`
					},
					setWhere: sql`excluded.last_played_at >= ${playbackHistory.lastPlayedAt}`
				});
		},

		listRecent: async (input) => {
			const conditions = [
				eq(playbackHistory.userId, input.userId),
				eq(playbackHistory.tenantId, input.tenantId),
				isNull(tracks.deletedAt)
			];

			if (input.cursor) {
				const c = decodeRecentCursor(input.cursor);
				const cursorDate = new Date(c.lastPlayedAt);
				conditions.push(
					or(
						lt(playbackHistory.lastPlayedAt, cursorDate),
						and(
							eq(playbackHistory.lastPlayedAt, cursorDate),
							lt(playbackHistory.trackId, c.trackId)
						)!
					)!
				);
			}

			const rows = await db
				.select()
				.from(playbackHistory)
				.innerJoin(tracks, eq(tracks.id, playbackHistory.trackId))
				.where(and(...conditions))
				.orderBy(desc(playbackHistory.lastPlayedAt), desc(playbackHistory.trackId))
				.limit(input.limit + 1);

			const hasMore = rows.length > input.limit;
			const sliced = rows.slice(0, input.limit);

			const items = sliced.map((r) =>
				toRecentTrackDto({
					playback: r.playback_history as RecentTrackJoinedRow['playback'],
					track: r.tracks as RecentTrackJoinedRow['track']
				})
			);

			let nextCursor: string | null = null;
			if (hasMore && sliced.length > 0) {
				const last = sliced[sliced.length - 1]!.playback_history as RecentTrackJoinedRow['playback'];
				const lastPlayedAtIso = toIso8601(toDate(last.lastPlayedAt)) as Iso8601;
				nextCursor = encodeRecentCursor(lastPlayedAtIso, last.trackId as Id<'track'>);
			}

			return { items, nextCursor };
		},

		listContinueListening: async (input) => {
			const rows = await db
				.select()
				.from(playbackHistory)
				.innerJoin(tracks, eq(tracks.id, playbackHistory.trackId))
				.where(
					and(
						eq(playbackHistory.userId, input.userId),
						eq(playbackHistory.tenantId, input.tenantId),
						isNull(tracks.deletedAt),
						gt(playbackHistory.lastPositionMs, 0),
						sql`${playbackHistory.lastPositionMs} < ${tracks.durationMs} - 15000`
					)
				)
				.orderBy(desc(playbackHistory.lastPlayedAt), desc(playbackHistory.trackId))
				.limit(input.limit);

			const items = rows.map((r) =>
				toRecentTrackDto({
					playback: r.playback_history as RecentTrackJoinedRow['playback'],
					track: r.tracks as RecentTrackJoinedRow['track']
				})
			);

			return { items, nextCursor: null };
		}
	};
}

function toDate(value: Date | number): Date {
	return value instanceof Date ? value : new Date(value * 1000);
}
