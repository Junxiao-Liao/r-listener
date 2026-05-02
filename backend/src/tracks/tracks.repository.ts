import { and, asc, desc, eq, gt, gte, inArray, isNull, like, lt, lte, or, sql } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { createId } from '../shared/id';
import { artists, trackArtists } from '../artists/artists.orm';
import { artistNameKey, dedupeArtistNames } from '../artists/artists.util';
import type { ArtistDto } from '../artists/artists.type';
import { playlistTracks, playlists } from '../playlists/playlists.orm';
import { toTrackDto } from './tracks.dto';
import { tracks } from './tracks.orm';
import type { LyricsStatus, TrackDto, TrackStatus } from './tracks.type';
import { cacheKey, cachePrefix, createKvCache, KV_TTL } from '../lib/kv-cache';

export type TrackRow = typeof tracks.$inferSelect;

type CursorData = { id: string; value: string | number };

export type TrackSortField = 'title' | 'album' | 'year' | 'durationMs' | 'createdAt' | 'updatedAt';
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
	artistNames: string[];
	album: string | null;
	contentType: string;
	sizeBytes: number;
	audioHash: string;
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
		artistNames?: string[];
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
	const cache = kv ? createKvCache(kv, { defaultTtlSeconds: KV_TTL.mutable }) : null;

	function trackKey(tenantId: Id<'tenant'>, trackId: Id<'track'>): string {
		return `cache:track:${tenantId}:${trackId}`;
	}

	async function invalidateTrackCache(tenantId: Id<'tenant'>, trackId: Id<'track'>): Promise<void> {
		if (cache) {
			let playlistRows: Array<{ id: string }> = [];
			try {
				playlistRows = await db
					.select({ id: playlistTracks.playlistId })
					.from(playlistTracks)
					.innerJoin(playlists, eq(playlists.id, playlistTracks.playlistId))
					.where(
						and(
							eq(playlistTracks.trackId, trackId),
							eq(playlists.tenantId, tenantId),
							isNull(playlistTracks.deletedAt),
							isNull(playlists.deletedAt)
						)
					);
			} catch {
			}
			await cache.invalidate(trackKey(tenantId, trackId));
			await cache.invalidatePrefix(cachePrefix('cache:tracks:list', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:tracks:row', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:artists:list', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:artist', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:artist-tracks', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playlist', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playlists:list', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:search', tenantId));
			await cache.invalidate(cacheKey('cache:queue:track', tenantId, trackId));
			await cache.invalidatePrefix(cachePrefix('cache:queue:items', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playback:visible-tracks', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playback:recent', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playback:continue', tenantId));
			for (const row of playlistRows) {
				await cache.invalidate(cacheKey('cache:playlist-tracks', row.id));
				await cache.invalidate(cacheKey('cache:playlist-tracks:all', row.id));
				await cache.invalidatePrefix(cachePrefix('cache:playlist-track-row', row.id));
			}
		}
	}
	return {
		listTracks: async (input) => {
			const key = cacheKey('cache:tracks:list', input.tenantId, {
				cursor: input.cursor,
				includePending: input.includePending,
				limit: input.limit,
				q: input.q,
				sortDir: input.sortDir,
				sortField: input.sortField
			});
			const cached = await cache?.tryGet<ListTracksResult>(key);
			if (cached) return cached;

			const conditions = [eq(tracks.tenantId, input.tenantId), isNull(tracks.deletedAt)];

			if (!input.includePending) {
				conditions.push(eq(tracks.status, 'ready' satisfies TrackStatus));
			}

			if (input.q) {
				const pattern = `%${input.q}%`;
				conditions.push(or(like(tracks.title, pattern), like(tracks.album, pattern), sql`EXISTS (
					SELECT 1 FROM ${trackArtists}
					INNER JOIN ${artists} ON ${artists.id} = ${trackArtists.artistId}
					WHERE ${trackArtists.trackId} = ${tracks.id}
						AND ${artists.deletedAt} IS NULL
						AND ${artists.name} LIKE ${pattern}
				)`)!);
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

			const result = { items: await toDtos(items), nextCursor };
			await cache?.put(key, result);
			return result;
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

			const result = rows[0] ? (await toDtos([rows[0]]))[0]! : null;
			if (cache && result) {
				await cache.put(key, result);
			}
			return result;
		},

		findRowById: async (trackId, tenantId) => {
			const key = cacheKey('cache:tracks:row', tenantId, trackId);
			const cached = await cache?.tryGet<TrackRow>(key);
			if (cached) return cached;
			const rows = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)))
				.limit(1);
			const result = rows[0] ?? null;
			if (result) await cache?.put(key, result);
			return result;
		},

		createTrack: async (input) => {
			const row: typeof tracks.$inferInsert = {
				id: input.id,
				tenantId: input.tenantId,
				uploaderId: input.uploaderId,
				title: input.title,
				album: input.album,
				contentType: input.contentType,
				sizeBytes: input.sizeBytes,
				audioHash: input.audioHash,
				audioR2Key: input.audioR2Key,
				status: 'pending',
				lyricsStatus: 'none',
				createdAt: input.now,
				updatedAt: input.now
			};
			await db.insert(tracks).values(row);
			await replaceTrackArtists(input.id, input.tenantId, input.artistNames, input.now);
			const created = await db
				.select()
				.from(tracks)
				.where(eq(tracks.id, input.id))
				.limit(1);
			const dto = (await toDtos(created))[0]!;
			if (cache) {
				await cache.put(trackKey(input.tenantId, input.id), dto);
				await cache.invalidatePrefix(cachePrefix('cache:tracks:list', input.tenantId));
				await cache.invalidatePrefix(cachePrefix('cache:artists:list', input.tenantId));
				await cache.invalidatePrefix(cachePrefix('cache:artist', input.tenantId));
				await cache.invalidatePrefix(cachePrefix('cache:artist-tracks', input.tenantId));
				await cache.invalidatePrefix(cachePrefix('cache:search', input.tenantId));
			}
			return dto;
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
			const dto = (await toDtos(updated))[0]!;
			await invalidateTrackCache(input.tenantId, input.trackId);
			await cache?.put(trackKey(input.tenantId, input.trackId), dto);
			return dto;
		},

		updateTrack: async (input) => {
			const set: Record<string, unknown> = { updatedAt: input.now };
			if (input.patch.title !== undefined) set.title = input.patch.title;
			if (input.patch.album !== undefined) set.album = input.patch.album;
			if (input.patch.trackNumber !== undefined) set.trackNumber = input.patch.trackNumber;
			if (input.patch.genre !== undefined) set.genre = input.patch.genre;
			if (input.patch.year !== undefined) set.year = input.patch.year;
			if (input.patch.durationMs !== undefined) set.durationMs = input.patch.durationMs;

			await db
				.update(tracks)
				.set(set as never)
				.where(and(eq(tracks.id, input.trackId), eq(tracks.tenantId, input.tenantId)));
			if (input.patch.artistNames !== undefined) {
				await replaceTrackArtists(
					input.trackId,
					input.tenantId,
					input.patch.artistNames,
					input.now
				);
			}
			const updated = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, input.trackId), eq(tracks.tenantId, input.tenantId)))
				.limit(1);
			const dto = (await toDtos(updated))[0]!;
			await invalidateTrackCache(input.tenantId, input.trackId);
			await cache?.put(trackKey(input.tenantId, input.trackId), dto);
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
			const dto = (await toDtos(updated))[0]!;
			await invalidateTrackCache(input.tenantId, input.trackId);
			await cache?.put(trackKey(input.tenantId, input.trackId), dto);
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
			const dto = (await toDtos(updated))[0]!;
			await invalidateTrackCache(tenantId, trackId);
			await cache?.put(trackKey(tenantId, trackId), dto);
			return dto;
		},

		softDelete: async (trackId, tenantId, now) => {
			const rows = await db
				.update(tracks)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)))
				.returning();
			await invalidateTrackCache(tenantId, trackId);
			return rows[0] ? (await toDtos([rows[0]]))[0]! : null;
		}
	};

	async function toDtos(rows: TrackRow[]): Promise<TrackDto[]> {
		const artistMap = await loadArtistsByTrackId(rows.map((row) => row.id));
		return rows.map((row) => toTrackDto(row, null, artistMap.get(row.id) ?? []));
	}

	async function loadArtistsByTrackId(trackIds: string[]): Promise<Map<string, ArtistDto[]>> {
		if (trackIds.length === 0) return new Map();
		const rows = await db
			.select({
				trackId: trackArtists.trackId,
				id: artists.id,
				name: artists.name
			})
			.from(trackArtists)
			.innerJoin(artists, eq(artists.id, trackArtists.artistId))
			.where(and(inArray(trackArtists.trackId, trackIds), isNull(artists.deletedAt)))
			.orderBy(asc(trackArtists.trackId), asc(trackArtists.position));

		const map = new Map<string, ArtistDto[]>();
		for (const row of rows) {
			const list = map.get(row.trackId) ?? [];
			list.push({ id: row.id as Id<'artist'>, name: row.name });
			map.set(row.trackId, list);
		}
		return map;
	}

	async function replaceTrackArtists(
		trackId: Id<'track'>,
		tenantId: Id<'tenant'>,
		names: readonly string[],
		now: Date
	): Promise<void> {
		await db.delete(trackArtists).where(eq(trackArtists.trackId, trackId));
		const artistRows = await upsertArtists(tenantId, names, now);
		if (artistRows.length === 0) return;
		await db.insert(trackArtists).values(
			artistRows.map((artist, position) => ({
				trackId,
				artistId: artist.id,
				position,
				createdAt: now
			}))
		);
	}

	async function upsertArtists(
		tenantId: Id<'tenant'>,
		names: readonly string[],
		now: Date
	): Promise<Array<typeof artists.$inferSelect>> {
		const normalized = dedupeArtistNames(names);
		const rows: Array<typeof artists.$inferSelect> = [];

		for (const name of normalized) {
			const nameKey = artistNameKey(name);
			const existing = await db
				.select()
				.from(artists)
				.where(and(eq(artists.tenantId, tenantId), eq(artists.nameKey, nameKey)))
				.limit(1);
			if (existing[0]) {
				if (existing[0].deletedAt !== null) {
					const restored = await db
						.update(artists)
						.set({ deletedAt: null, updatedAt: now })
						.where(eq(artists.id, existing[0].id))
						.returning();
					rows.push(restored[0] ?? existing[0]);
				} else {
					rows.push(existing[0]);
				}
				continue;
			}

			const row: typeof artists.$inferInsert = {
				id: createId('art_'),
				tenantId,
				name,
				nameKey,
				createdAt: now,
				updatedAt: now
			};
			await db.insert(artists).values(row);
			const created = await db
				.select()
				.from(artists)
				.where(eq(artists.id, row.id))
				.limit(1);
			rows.push(created[0]!);
		}

		return rows;
	}
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
