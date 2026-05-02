import { and, asc, eq, gt, inArray, isNull, like, or, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { encodeBase64Cursor, decodeBase64Cursor } from '../shared/cursor';
import type { Id } from '../shared/shared.type';
import { tracks } from '../tracks/tracks.orm';
import type { TrackStatus } from '../tracks/tracks.type';
import { toTrackDto } from '../tracks/tracks.dto';
import { toArtistAggregateDto, toArtistDto } from './artists.dto';
import { artists, trackArtists } from './artists.orm';
import type { ArtistAggregateDto, ArtistDto, ArtistTrackListResult, ListArtistsResult } from './artists.type';
import { artistNameKey } from './artists.util';

type CursorData = { id: string; nameKey: string };

export type ListArtistsInput = {
	tenantId: Id<'tenant'>;
	q?: string | undefined;
	cursor?: string | undefined;
	limit: number;
};

export type ArtistsRepository = {
	listArtists(input: ListArtistsInput): Promise<ListArtistsResult>;
	findArtist(input: { tenantId: Id<'tenant'>; artistId: Id<'artist'> }): Promise<ArtistAggregateDto | null>;
	listArtistTracks(input: { tenantId: Id<'tenant'>; artistId: Id<'artist'> }): Promise<ArtistTrackListResult>;
};

export function createArtistsRepository(db: Db): ArtistsRepository {
	return {
		listArtists: async (input) => {
			const conditions = [eq(artists.tenantId, input.tenantId), isNull(artists.deletedAt)];

			if (input.q && input.q.trim().length > 0) {
				conditions.push(like(artists.nameKey, `%${artistNameKey(input.q)}%`));
			}

			if (input.cursor) {
				const cursor = decodeCursor(input.cursor);
				conditions.push(
					or(
						gt(artists.nameKey, cursor.nameKey),
						and(eq(artists.nameKey, cursor.nameKey), gt(artists.id, cursor.id))!
					)!
				);
			}

			const rows = await db
				.select()
				.from(artists)
				.where(and(...conditions))
				.orderBy(asc(artists.nameKey), asc(artists.id))
				.limit(input.limit + 1);

			const items = rows.slice(0, input.limit);
			const nextItem = rows.length > input.limit ? items.at(-1) : null;

			const result = {
				items: items.map(toArtistDto),
				nextCursor: nextItem ? encodeCursor({ id: nextItem.id, nameKey: nextItem.nameKey }) : null
			};
			return result;
		},

		findArtist: async ({ tenantId, artistId }) => {
			const artistRows = await db
				.select()
				.from(artists)
				.where(
					and(
						eq(artists.id, artistId),
						eq(artists.tenantId, tenantId),
						isNull(artists.deletedAt)
					)
				)
				.limit(1);
			if (!artistRows[0]) return null;

			const aggRows = await db
				.select({
					count: sql<number>`COUNT(${tracks.id})`,
					total: sql<number>`COALESCE(SUM(${tracks.durationMs}), 0)`
				})
				.from(trackArtists)
				.innerJoin(tracks, eq(tracks.id, trackArtists.trackId))
				.where(
					and(
						eq(trackArtists.artistId, artistId),
						eq(tracks.tenantId, tenantId),
						eq(tracks.status, 'ready' satisfies TrackStatus),
						isNull(tracks.deletedAt)
					)
				);
			const agg = aggRows[0]!;
			const result = toArtistAggregateDto(artistRows[0], {
				trackCount: Number(agg.count ?? 0),
				totalDurationMs: Number(agg.total ?? 0)
			});

			return result;
		},

		listArtistTracks: async ({ tenantId, artistId }) => {
			const rows = await db
				.select()
				.from(trackArtists)
				.innerJoin(tracks, eq(tracks.id, trackArtists.trackId))
				.where(
					and(
						eq(trackArtists.artistId, artistId),
						eq(tracks.tenantId, tenantId),
						eq(tracks.status, 'ready' satisfies TrackStatus),
						isNull(tracks.deletedAt)
					)
				)
				.orderBy(asc(tracks.title), asc(tracks.id));

			const artistMap = await loadArtistsByTrackId(rows.map((r) => r.tracks.id));

			const result: ArtistTrackListResult = {
				items: rows.map((r) => toTrackDto(r.tracks, null, artistMap.get(r.tracks.id) ?? []))
			};

			return result;
		}
	};

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
}

function encodeCursor(data: CursorData): string {
	return encodeBase64Cursor(data);
}

function decodeCursor(cursor: string): CursorData {
	try {
		const data = decodeBase64Cursor<Partial<CursorData>>(cursor);
		return {
			id: typeof data.id === 'string' ? data.id : '',
			nameKey: typeof data.nameKey === 'string' ? data.nameKey : ''
		};
	} catch {
		return { id: '', nameKey: '' };
	}
}
