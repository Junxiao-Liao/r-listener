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
import { cacheKey, createKvCache, KV_TTL } from '../lib/kv-cache';

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

type BufferedEvent = {
	userId: string;
	tenantId: string;
	trackId: string;
	lastPlayedAt: number;
	lastPositionMs: number;
	playlistId: string | null;
	updatedAt: number;
};

function bufferKey(userId: Id<'user'>, tenantId: Id<'tenant'>): string {
	return `buffer:history:${userId}:${tenantId}`;
}

async function drainBuffer(db: Db, kv: KVNamespace, userId: Id<'user'>, tenantId: Id<'tenant'>): Promise<void> {
	const key = bufferKey(userId, tenantId);
	try {
		const raw = await kv.get(key, 'json');
		if (!raw) return;
		const events = raw as BufferedEvent[];
		if (!Array.isArray(events) || events.length === 0) {
			await kv.delete(key);
			return;
		}

		const latestByTrack = new Map<string, BufferedEvent>();
		for (const e of events) {
			const existing = latestByTrack.get(e.trackId);
			if (!existing || e.lastPlayedAt > existing.lastPlayedAt) {
				latestByTrack.set(e.trackId, e);
			}
		}

		for (const e of latestByTrack.values()) {
			await db
				.insert(playbackHistory)
				.values({
					userId: e.userId as Id<'user'>,
					tenantId: e.tenantId as Id<'tenant'>,
					trackId: e.trackId as Id<'track'>,
					lastPlaylistId: e.playlistId as Id<'playlist'> | null,
					lastPlayedAt: new Date(e.lastPlayedAt),
					lastPositionMs: e.lastPositionMs,
					updatedAt: new Date(e.updatedAt)
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
		}

		await kv.delete(key);
	} catch (err) {
		console.error('drainBuffer error:', err);
	}
}

async function bufferEvents(kv: KVNamespace, userId: Id<'user'>, tenantId: Id<'tenant'>, event: BufferedEvent): Promise<void> {
	const key = bufferKey(userId, tenantId);
	try {
		const raw = await kv.get(key, 'json');
		const events: BufferedEvent[] = raw ? (raw as BufferedEvent[]) : [];
		events.push(event);
		await kv.put(key, JSON.stringify(events), { expirationTtl: 3600 });
	} catch (err) {
		console.error('bufferEvents error:', err);
	}
}

export function createPlaybackRepository(db: Db, kv?: KVNamespace): PlaybackRepository {
	const cache = kv ? createKvCache(kv, { defaultTtlSeconds: KV_TTL.highChurn }) : null;

	function recentKey(input: ListRecentInput): string {
		return cacheKey('cache:playback:recent', input.tenantId, input.userId, {
			cursor: input.cursor,
			limit: input.limit
		});
	}

	function continueKey(input: ListContinueListeningInput): string {
		return cacheKey('cache:playback:continue', input.tenantId, input.userId, input.limit);
	}

	async function invalidatePlayback(input: { userId: Id<'user'>; tenantId: Id<'tenant'> }): Promise<void> {
		await cache?.invalidatePrefix(cacheKey('cache:playback:recent', input.tenantId, input.userId));
		await cache?.invalidatePrefix(cacheKey('cache:playback:continue', input.tenantId, input.userId));
	}

	return {
		filterVisibleTrackIds: async (trackIds, tenantId) => {
			if (trackIds.length === 0) return new Set();
			const key = cacheKey('cache:playback:visible-tracks', tenantId, [...trackIds].sort());
			const cached = await cache?.tryGet<Id<'track'>[]>(key);
			if (cached) return new Set(cached);

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
			const result = trackIds.filter((id) => ready.has(id));
			await cache?.put(key, result, KV_TTL.highChurn);
			return new Set(result);
		},

		upsertHistory: async (input) => {
			if (kv) {
				const event: BufferedEvent = {
					userId: input.userId,
					tenantId: input.tenantId,
					trackId: input.trackId,
					lastPlayedAt: input.lastPlayedAt.getTime(),
					lastPositionMs: input.lastPositionMs,
					playlistId: input.playlistId,
					updatedAt: input.now.getTime()
				};
				try {
					const buffered = (await kv.get(bufferKey(input.userId, input.tenantId), 'json')) as BufferedEvent[] | null;
					if (buffered && buffered.length >= 10) {
						await drainBuffer(db, kv, input.userId, input.tenantId);
					}
				} catch {
				}
				await bufferEvents(kv, input.userId, input.tenantId, event);
			} else {
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
			}
			await invalidatePlayback(input);
		},

		listRecent: async (input) => {
			if (kv) await drainBuffer(db, kv, input.userId, input.tenantId);
			const key = recentKey(input);
			const cached = await cache?.tryGet<RecentTracksPage>(key);
			if (cached) return cached;

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

			const result = { items, nextCursor };
			await cache?.put(key, result, KV_TTL.highChurn);
			return result;
		},

		listContinueListening: async (input) => {
			if (kv) await drainBuffer(db, kv, input.userId, input.tenantId);
			const key = continueKey(input);
			const cached = await cache?.tryGet<RecentTracksPage>(key);
			if (cached) return cached;

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

			const result = { items, nextCursor: null };
			await cache?.put(key, result, KV_TTL.highChurn);
			return result;
		}
	};
}

function toDate(value: Date | number): Date {
	return value instanceof Date ? value : new Date(value * 1000);
}
