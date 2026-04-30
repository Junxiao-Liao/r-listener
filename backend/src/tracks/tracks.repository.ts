import { and, asc, desc, eq, gt, gte, isNull, like, lt, lte, or, sql } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { toTrackDto } from './tracks.dto';
import { tracks } from './tracks.orm';
import type { LyricsStatus, TrackDto, TrackStatus } from './tracks.type';
import { createKvCache, type KvCache } from '../lib/kv-cache';

export type TrackRow = typeof tracks.$inferSelect;

type CursorData = { id: string; value: string | number };

export type TrackSortField = 'title' | 'artist' | 'album' | 'year' | 'durationMs' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export type ListTracksInput = {
	tenantId: Id<'tenant'>;
	cursor?: string | undefined;
	limit: number;
	sortField: TrackSortField;
	sortDir: SortDirection;
	q?: string | undefined;
	includePending: boolean;
};

export type ListTracksResult = {
	items: TrackDto[];
	nextCursor: string | null;
};

export type TracksRepository = {
	listTracks(input: ListTracksInput): Promise<ListTracksResult>;
	findById(trackId: Id<'track'>, tenantId: Id<'tenant'>): Promise<TrackDto | null>;
	findRowById(trackId: Id<'track'>, tenantId: Id<'tenant'>): Promise<TrackRow | null>;
	createTrack(input: CreateTrackInput): Promise<TrackDto>;
	finalizeTrack(input: FinalizeTrackRepoInput): Promise<TrackDto>;
	updateTrack(input: UpdateTrackRepoInput): Promise<TrackDto>;
	setLyrics(input: SetLyricsRepoInput): Promise<TrackDto>;
	clearLyrics(trackId: Id<'track'>, tenantId: Id<'tenant'>, now: Date): Promise<TrackDto>;
	softDelete(trackId: Id<'track'>, tenantId: Id<'tenant'>, now: Date): Promise<TrackDto | null>;
};

export type CreateTrackInput = {
	id: Id<'track'>;
	tenantId: Id<'tenant'>;
	uploaderId: Id<'user'>;
	title: string;
	artist: string | null;
	album: string | null;
	contentType: string;
	sizeBytes: number;
	audioR2Key: string;
	now: Date;
};

export type FinalizeTrackRepoInput = {
	trackId: Id<'track'>;
	tenantId: Id<'tenant'>;
	durationMs: number;
	lyricsLrc: string | null;
	lyricsStatus: LyricsStatus;
	trackNumber: number | null;
	genre: string | null;
	year: number | null;
	now: Date;
};

export type UpdateTrackRepoInput = {
	trackId: Id<'track'>;
	tenantId: Id<'tenant'>;
	patch: {
		title?: string;
		artist?: string | null;
		album?: string | null;
		trackNumber?: number | null;
		genre?: string | null;
		year?: number | null;
		durationMs?: number | null;
	};
	now: Date;
};

export type SetLyricsRepoInput = {
	trackId: Id<'track'>;
	tenantId: Id<'tenant'>;
	lyricsLrc: string;
	lyricsStatus: LyricsStatus;
	now: Date;
};

export function createTracksRepository(db: Db, kv?: KVNamespace): TracksRepository {
	const cache = kv ? createKvCache(kv, { defaultTtlSeconds: 300 }) : null;

	function trackKey(tenantId: Id<'tenant'>, trackId: Id<'track'>): string {
		return `cache:track:${tenantId}:${trackId}`;
	}

	async function invalidateTrackCache(tenantId: Id<'tenant'>, trackId: Id<'track'>): Promise<void> {
		if (cache) {
			await cache.invalidate(trackKey(tenantId, trackId));
			await cache.invalidatePrefix(`cache:tracks:list:${tenantId}:`);
		}
	}
	return {
		listTracks: async (input) => {
			const conditions = [eq(tracks.tenantId, input.tenantId), isNull(tracks.deletedAt)];

			if (!input.includePending) {
				conditions.push(eq(tracks.status, 'ready' satisfies TrackStatus));
			}

			if (input.q) {
				const pattern = `%${input.q}%`;
				conditions.push(
					or(like(tracks.title, pattern), like(tracks.artist, pattern), like(tracks.album, pattern))!
				);
			}

			const cursorCondition = buildCursorCondition(input);
			if (cursorCondition) {
				conditions.push(cursorCondition);
			}

			const sortCol = columnForSortField(input.sortField);
			const orderFn = input.sortDir === 'asc' ? asc : desc;
			const tiebreakFn = input.sortDir === 'asc' ? asc : desc;

			const rows = await db
				.select()
				.from(tracks)
				.where(and(...conditions))
				.orderBy(orderFn(sortCol), tiebreakFn(tracks.id))
				.limit(input.limit + 1);

			const hasMore = rows.length > input.limit;
			const items = rows.slice(0, input.limit);

			let nextCursor: string | null = null;
			if (hasMore && items.length > 0) {
				const lastItem = items[items.length - 1]!;
				nextCursor = encodeCursor({
					id: lastItem.id,
					value: cursorSortValue(lastItem, input.sortField)
				});
			}

			return {
				items: items.map((r) => toTrackDto(r, null)),
				nextCursor
			};
		},

		findById: async (trackId, tenantId) => {
			const key = trackKey(tenantId, trackId);
			const cached = await cache?.tryGet<ReturnType<typeof toTrackDto>>(key);
			if (cached) return cached;

			const rows = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)))
				.limit(1);

			const result = rows[0] ? toTrackDto(rows[0], null) : null;
			if (cache && result) {
				await cache.put(key, result);
			}
			return result;
		},

		findRowById: async (trackId, tenantId) => {
			const rows = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)))
				.limit(1);
			return rows[0] ?? null;
		},

		createTrack: async (input) => {
			const row: typeof tracks.$inferInsert = {
				id: input.id,
				tenantId: input.tenantId,
				uploaderId: input.uploaderId,
				title: input.title,
				artist: input.artist,
				album: input.album,
				contentType: input.contentType,
				sizeBytes: input.sizeBytes,
				audioR2Key: input.audioR2Key,
				status: 'pending',
				lyricsStatus: 'none',
				createdAt: input.now,
				updatedAt: input.now
			};
			await db.insert(tracks).values(row);
			const created = await db
				.select()
				.from(tracks)
				.where(eq(tracks.id, input.id))
				.limit(1);
			return toTrackDto(created[0]!, null);
		},

		finalizeTrack: async (input) => {
			await db
				.update(tracks)
				.set({
					status: 'ready',
					durationMs: input.durationMs,
					lyricsLrc: input.lyricsLrc,
					lyricsStatus: input.lyricsStatus,
					trackNumber: input.trackNumber,
					genre: input.genre,
					year: input.year,
					updatedAt: input.now
				})
				.where(and(eq(tracks.id, input.trackId), eq(tracks.tenantId, input.tenantId)));
			const updated = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, input.trackId), eq(tracks.tenantId, input.tenantId)))
				.limit(1);
			const dto = toTrackDto(updated[0]!, null);
			await invalidateTrackCache(input.tenantId, input.trackId);
			return dto;
		},

		updateTrack: async (input) => {
			const set: Record<string, unknown> = { updatedAt: input.now };
			if (input.patch.title !== undefined) set.title = input.patch.title;
			if (input.patch.artist !== undefined) set.artist = input.patch.artist;
			if (input.patch.album !== undefined) set.album = input.patch.album;
			if (input.patch.trackNumber !== undefined) set.trackNumber = input.patch.trackNumber;
			if (input.patch.genre !== undefined) set.genre = input.patch.genre;
			if (input.patch.year !== undefined) set.year = input.patch.year;
			if (input.patch.durationMs !== undefined) set.durationMs = input.patch.durationMs;

			await db
				.update(tracks)
				.set(set as never)
				.where(and(eq(tracks.id, input.trackId), eq(tracks.tenantId, input.tenantId)));
			const updated = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, input.trackId), eq(tracks.tenantId, input.tenantId)))
				.limit(1);
			const dto = toTrackDto(updated[0]!, null);
			await invalidateTrackCache(input.tenantId, input.trackId);
			return dto;
		},

		setLyrics: async (input) => {
			await db
				.update(tracks)
				.set({
					lyricsLrc: input.lyricsLrc,
					lyricsStatus: input.lyricsStatus,
					updatedAt: input.now
				})
				.where(and(eq(tracks.id, input.trackId), eq(tracks.tenantId, input.tenantId)));
			const updated = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, input.trackId), eq(tracks.tenantId, input.tenantId)))
				.limit(1);
			const dto = toTrackDto(updated[0]!, null);
			await invalidateTrackCache(input.tenantId, input.trackId);
			return dto;
		},

		clearLyrics: async (trackId, tenantId, now) => {
			await db
				.update(tracks)
				.set({
					lyricsLrc: null,
					lyricsStatus: 'none',
					updatedAt: now
				})
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId)));
			const updated = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId)))
				.limit(1);
			const dto = toTrackDto(updated[0]!, null);
			await invalidateTrackCache(tenantId, trackId);
			return dto;
		},

		softDelete: async (trackId, tenantId, now) => {
			const rows = await db
				.update(tracks)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)))
				.returning();
			await invalidateTrackCache(tenantId, trackId);
			return rows[0] ? toTrackDto(rows[0], null) : null;
		}
	};
}

function encodeCursor(data: CursorData): string {
	return btoa(JSON.stringify(data));
}

function decodeCursor(cursor: string): CursorData {
	return JSON.parse(atob(cursor));
}

function columnForSortField(field: TrackSortField) {
	switch (field) {
		case 'title':
			return tracks.title;
		case 'artist':
			return tracks.artist;
		case 'album':
			return tracks.album;
		case 'year':
			return tracks.year;
		case 'durationMs':
			return tracks.durationMs;
		case 'createdAt':
			return tracks.createdAt;
		case 'updatedAt':
			return tracks.updatedAt;
	}
}

function cursorSortValue(row: TrackRow, field: TrackSortField): string | number {
	switch (field) {
		case 'title':
			return row.title;
		case 'artist':
			return row.artist ?? '';
		case 'album':
			return row.album ?? '';
		case 'year':
			return row.year ?? 0;
		case 'durationMs':
			return row.durationMs ?? 0;
		case 'createdAt':
			return row.createdAt.getTime();
		case 'updatedAt':
			return row.updatedAt.getTime();
	}
}

function buildCursorCondition(
	input: Pick<ListTracksInput, 'cursor' | 'sortField' | 'sortDir'>
): ReturnType<typeof and> | null {
	if (!input.cursor) return null;

	const cursorData = decodeCursor(input.cursor);
	const col = columnForSortField(input.sortField);
	const isAsc = input.sortDir === 'asc';

	if (isAsc) {
		return or(
			gt(col, cursorData.value),
			and(eq(col, cursorData.value), gte(tracks.id, cursorData.id))!
		)!;
	}
	return or(
		lt(col, cursorData.value),
		and(eq(col, cursorData.value), lte(tracks.id, cursorData.id))!
	)!;
}
