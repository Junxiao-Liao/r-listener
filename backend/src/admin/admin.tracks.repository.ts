import { and, asc, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { artists, trackArtists } from '../artists/artists.orm';
import { auditLogs } from '../audit/audit.orm';
import type { Db } from '../db';
import { createId } from '../shared/id';
import type { Id } from '../shared/shared.type';
import { tenants } from '../tenants/tenants.orm';
import { toTrackDto } from '../tracks/tracks.dto';
import { tracks } from '../tracks/tracks.orm';
import type { AdminTrackListItemDto, AdminTrackListQuery, AdminTrackDeleteCandidate } from './admin.tracks.type';
import type { AdminListResponse } from './admin.type';

export type AdminTracksRepository = {
	listTracks(query: AdminTrackListQuery): Promise<AdminListResponse<AdminTrackListItemDto>>;
	findTracksForDelete(trackIds: Id<'track'>[]): Promise<AdminTrackDeleteCandidate[]>;
	findReferencedR2Keys(audioR2Keys: string[], excludeTrackIds: Id<'track'>[]): Promise<string[]>;
	hardDeleteTracks(trackIds: Id<'track'>[]): Promise<number>;
	insertTrackHardDeleteAuditLogs(input: {
		actorId: Id<'user'>;
		now: Date;
		entries: Array<{
			trackId: Id<'track'>;
			tenantId: Id<'tenant'>;
			audioR2Key: string;
			sizeBytes: number;
			r2Deleted: boolean;
		}>;
	}): Promise<void>;
};

export function createAdminTracksRepository(db: Db): AdminTracksRepository {
	return {
		listTracks: async (query) => {
			const offset = decodeCursor(query.cursor);
			const filters = [sql`1 = 1`];

			if (query.q) {
				const pattern = `%${escapeLike(query.q)}%`;
				filters.push(
					or(
						like(tracks.title, pattern),
						like(tracks.album, pattern),
						sql`EXISTS (
							SELECT 1 FROM ${trackArtists}
							INNER JOIN ${artists} ON ${artists.id} = ${trackArtists.artistId}
							WHERE ${trackArtists.trackId} = ${tracks.id}
								AND ${artists.deletedAt} IS NULL
								AND ${artists.name} LIKE ${pattern}
						)`
					)!
				);
			}

			if (query.tenantId) {
				filters.push(eq(tracks.tenantId, query.tenantId));
			}

			const rows = await db
				.select({
					track: tracks,
					tenantName: tenants.name,
					tenantDeletedAt: tenants.deletedAt
				})
				.from(tracks)
				.leftJoin(tenants, eq(tracks.tenantId, tenants.id))
				.where(and(...filters))
				.orderBy(desc(tracks.createdAt), desc(tracks.id))
				.limit(query.limit + 1)
				.offset(offset);

			const page = rows.slice(0, query.limit);
			const artistMap = await loadArtistsByTrackId(page.map((row) => row.track.id));

			return {
				items: page.map(({ track, tenantName, tenantDeletedAt }) => ({
					...toTrackDto(track, null, artistMap.get(track.id) ?? []),
					tenantName: tenantName ?? track.tenantId,
					tenantDeleted: tenantDeletedAt !== null,
					isDeleted: track.deletedAt !== null,
					audioR2Key: track.audioR2Key
				})),
				nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null
			};
		},
		findTracksForDelete: async (trackIds) => {
			if (trackIds.length === 0) return [];
			const rows = await db
				.select({
					id: tracks.id,
					tenantId: tracks.tenantId,
					audioR2Key: tracks.audioR2Key,
					sizeBytes: tracks.sizeBytes
				})
				.from(tracks)
				.where(inArray(tracks.id, trackIds));
			return rows.map((row) => ({
				id: row.id as Id<'track'>,
				tenantId: row.tenantId as Id<'tenant'>,
				audioR2Key: row.audioR2Key,
				sizeBytes: row.sizeBytes
			}));
		},
		findReferencedR2Keys: async (audioR2Keys, excludeTrackIds) => {
			if (audioR2Keys.length === 0) return [];
			const rows = await db
				.select({
					id: tracks.id,
					audioR2Key: tracks.audioR2Key
				})
				.from(tracks)
				.where(and(inArray(tracks.audioR2Key, audioR2Keys), isNull(tracks.deletedAt)));
			const excluded = new Set(excludeTrackIds);
			return [...new Set(rows.filter((row) => !excluded.has(row.id as Id<'track'>)).map((row) => row.audioR2Key))];
		},
		hardDeleteTracks: async (trackIds) => {
			if (trackIds.length === 0) return 0;
			const existing = await db
				.select({ id: tracks.id })
				.from(tracks)
				.where(inArray(tracks.id, trackIds));
			if (existing.length === 0) return 0;
			await db.delete(tracks).where(inArray(tracks.id, trackIds));
			return existing.length;
		},
		insertTrackHardDeleteAuditLogs: async ({ actorId, now, entries }) => {
			if (entries.length === 0) return;
			await db.insert(auditLogs).values(
				entries.map((entry) => ({
					id: createId('aud_'),
					actorId,
					action: 'track.hard_delete',
					targetType: 'track',
					targetId: entry.trackId,
					tenantId: entry.tenantId,
					meta: {
						audioR2Key: entry.audioR2Key,
						sizeBytes: entry.sizeBytes,
						r2Deleted: entry.r2Deleted
					},
					createdAt: now
				}))
			);
		}
	};

	async function loadArtistsByTrackId(trackIds: string[]) {
		if (trackIds.length === 0) return new Map<string, Array<{ id: Id<'artist'>; name: string }>>();
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

		const map = new Map<string, Array<{ id: Id<'artist'>; name: string }>>();
		for (const row of rows) {
			const list = map.get(row.trackId) ?? [];
			list.push({ id: row.id as Id<'artist'>, name: row.name });
			map.set(row.trackId, list);
		}
		return map;
	}
}

function encodeCursor(offset: number): string {
	return btoa(JSON.stringify({ offset }));
}

function decodeCursor(cursor: string | undefined): number {
	if (!cursor) return 0;
	try {
		const value = JSON.parse(atob(cursor)) as { offset?: unknown };
		return typeof value.offset === 'number' && value.offset >= 0 ? value.offset : 0;
	} catch {
		return 0;
	}
}

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

