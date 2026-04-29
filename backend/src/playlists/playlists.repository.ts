import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	isNull,
	like,
	lt,
	lte,
	or,
	sql
} from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { tracks } from '../tracks/tracks.orm';
import type { TrackStatus } from '../tracks/tracks.type';
import type {
	PlaylistRow,
	PlaylistTrackRow,
	PlaylistTrackWithTrack,
	TrackRow
} from './playlists.dto';
import { playlistTracks, playlists } from './playlists.orm';

export type PlaylistSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export type PlaylistAggregate = {
	row: PlaylistRow;
	trackCount: number;
	totalDurationMs: number;
};

export type ListPlaylistsInput = {
	tenantId: Id<'tenant'>;
	cursor?: string | undefined;
	limit: number;
	sortField: PlaylistSortField;
	sortDir: SortDirection;
	q?: string | undefined;
};

export type ListPlaylistsResult = {
	items: PlaylistAggregate[];
	nextCursor: string | null;
};

export type FindPlaylistInput = {
	tenantId: Id<'tenant'>;
	playlistId: Id<'playlist'>;
};

export type FindPlaylistByNameInput = {
	tenantId: Id<'tenant'>;
	name: string;
	excludeId?: Id<'playlist'> | undefined;
};

export type InsertPlaylistInput = {
	id: Id<'playlist'>;
	tenantId: Id<'tenant'>;
	ownerId: Id<'user'>;
	name: string;
	description: string | null;
	now: Date;
};

export type UpdatePlaylistInput = {
	tenantId: Id<'tenant'>;
	playlistId: Id<'playlist'>;
	set: { name?: string; description?: string | null };
	now: Date;
};

export type SoftDeletePlaylistInput = {
	tenantId: Id<'tenant'>;
	playlistId: Id<'playlist'>;
	now: Date;
};

export type ListPlaylistTracksInput = {
	playlistId: Id<'playlist'>;
};

export type FindPlaylistTrackInput = {
	playlistId: Id<'playlist'>;
	trackId: Id<'track'>;
};

export type InsertPlaylistTrackInput = {
	playlistId: Id<'playlist'>;
	trackId: Id<'track'>;
	positionFrac: number;
	now: Date;
};

export type SetPositionsInput = {
	playlistId: Id<'playlist'>;
	updates: Array<{ id: string; positionFrac: number }>;
};

export type SoftDeletePlaylistTrackInput = {
	playlistId: Id<'playlist'>;
	trackId: Id<'track'>;
	now: Date;
};

export type TouchPlaylistInput = {
	tenantId: Id<'tenant'>;
	playlistId: Id<'playlist'>;
	now: Date;
};

export type PlaylistsRepository = {
	listPlaylists(input: ListPlaylistsInput): Promise<ListPlaylistsResult>;
	findPlaylist(input: FindPlaylistInput): Promise<PlaylistAggregate | null>;
	findPlaylistByName(input: FindPlaylistByNameInput): Promise<PlaylistRow | null>;
	insertPlaylist(input: InsertPlaylistInput): Promise<PlaylistAggregate>;
	updatePlaylist(input: UpdatePlaylistInput): Promise<PlaylistAggregate | null>;
	softDeletePlaylist(input: SoftDeletePlaylistInput): Promise<PlaylistRow | null>;
	listPlaylistTracks(input: ListPlaylistTracksInput): Promise<PlaylistTrackWithTrack[]>;
	listAllPlaylistTrackRows(input: ListPlaylistTracksInput): Promise<PlaylistTrackRow[]>;
	findPlaylistTrack(input: FindPlaylistTrackInput): Promise<PlaylistTrackRow | null>;
	findTrack(trackId: Id<'track'>, tenantId: Id<'tenant'>): Promise<TrackRow | null>;
	insertPlaylistTrack(input: InsertPlaylistTrackInput): Promise<PlaylistTrackRow>;
	setPositions(input: SetPositionsInput): Promise<void>;
	softDeletePlaylistTrack(input: SoftDeletePlaylistTrackInput): Promise<PlaylistTrackRow | null>;
	touchPlaylist(input: TouchPlaylistInput): Promise<void>;
};

type CursorData = { id: string; value: string | number };

export function createPlaylistsRepository(db: Db): PlaylistsRepository {
	async function loadAggregate(playlistId: string): Promise<{
		trackCount: number;
		totalDurationMs: number;
	}> {
		const rows = await db
			.select({
				count: sql<number>`COUNT(${tracks.id})`,
				total: sql<number>`COALESCE(SUM(${tracks.durationMs}), 0)`
			})
			.from(playlistTracks)
			.innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
			.where(
				and(
					eq(playlistTracks.playlistId, playlistId),
					isNull(playlistTracks.deletedAt),
					eq(tracks.status, 'ready' satisfies TrackStatus),
					isNull(tracks.deletedAt)
				)
			);
		const r = rows[0];
		return {
			trackCount: Number(r?.count ?? 0),
			totalDurationMs: Number(r?.total ?? 0)
		};
	}

	async function attachAggregates(rows: PlaylistRow[]): Promise<PlaylistAggregate[]> {
		const result: PlaylistAggregate[] = [];
		for (const row of rows) {
			const agg = await loadAggregate(row.id);
			result.push({ row, ...agg });
		}
		return result;
	}

	return {
		listPlaylists: async (input) => {
			const conditions = [eq(playlists.tenantId, input.tenantId), isNull(playlists.deletedAt)];

			if (input.q) {
				const pattern = `%${input.q}%`;
				conditions.push(or(like(playlists.name, pattern), like(playlists.description, pattern))!);
			}

			const cursorCondition = buildCursorCondition(input);
			if (cursorCondition) conditions.push(cursorCondition);

			const sortCol = columnForSortField(input.sortField);
			const orderFn = input.sortDir === 'asc' ? asc : desc;

			const rows = await db
				.select()
				.from(playlists)
				.where(and(...conditions))
				.orderBy(orderFn(sortCol), orderFn(playlists.id))
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
				items: await attachAggregates(items),
				nextCursor
			};
		},

		findPlaylist: async ({ tenantId, playlistId }) => {
			const rows = await db
				.select()
				.from(playlists)
				.where(
					and(
						eq(playlists.id, playlistId),
						eq(playlists.tenantId, tenantId),
						isNull(playlists.deletedAt)
					)
				)
				.limit(1);
			if (!rows[0]) return null;
			const agg = await loadAggregate(rows[0].id);
			return { row: rows[0], ...agg };
		},

		findPlaylistByName: async ({ tenantId, name, excludeId }) => {
			const conditions = [
				eq(playlists.tenantId, tenantId),
				eq(playlists.name, name),
				isNull(playlists.deletedAt)
			];
			const rows = await db
				.select()
				.from(playlists)
				.where(and(...conditions))
				.limit(2);
			const match = rows.find((r) => (excludeId ? r.id !== excludeId : true));
			return match ?? null;
		},

		insertPlaylist: async (input) => {
			const row = {
				id: input.id,
				tenantId: input.tenantId,
				ownerId: input.ownerId,
				name: input.name,
				description: input.description,
				createdAt: input.now,
				updatedAt: input.now
			} satisfies typeof playlists.$inferInsert;

			await db.insert(playlists).values(row);
			const created = await db
				.select()
				.from(playlists)
				.where(eq(playlists.id, input.id))
				.limit(1);
			return { row: created[0]!, trackCount: 0, totalDurationMs: 0 };
		},

		updatePlaylist: async (input) => {
			const set: Record<string, unknown> = { updatedAt: input.now };
			if (input.set.name !== undefined) set.name = input.set.name;
			if (input.set.description !== undefined) set.description = input.set.description;

			await db
				.update(playlists)
				.set(set as never)
				.where(
					and(
						eq(playlists.id, input.playlistId),
						eq(playlists.tenantId, input.tenantId),
						isNull(playlists.deletedAt)
					)
				);

			const rows = await db
				.select()
				.from(playlists)
				.where(eq(playlists.id, input.playlistId))
				.limit(1);
			if (!rows[0] || rows[0].deletedAt !== null) return null;
			const agg = await loadAggregate(rows[0].id);
			return { row: rows[0], ...agg };
		},

		softDeletePlaylist: async (input) => {
			const rows = await db
				.update(playlists)
				.set({ deletedAt: input.now, updatedAt: input.now })
				.where(
					and(
						eq(playlists.id, input.playlistId),
						eq(playlists.tenantId, input.tenantId),
						isNull(playlists.deletedAt)
					)
				)
				.returning();
			return rows[0] ?? null;
		},

		listPlaylistTracks: async ({ playlistId }) => {
			const rows = await db
				.select()
				.from(playlistTracks)
				.innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
				.where(
					and(
						eq(playlistTracks.playlistId, playlistId),
						isNull(playlistTracks.deletedAt),
						eq(tracks.status, 'ready' satisfies TrackStatus),
						isNull(tracks.deletedAt)
					)
				)
				.orderBy(asc(playlistTracks.positionFrac), asc(playlistTracks.id));

			return rows.map((r) => ({
				row: r.playlist_tracks as PlaylistTrackRow,
				track: r.tracks as TrackRow
			}));
		},

		listAllPlaylistTrackRows: async ({ playlistId }) => {
			const rows = await db
				.select()
				.from(playlistTracks)
				.where(
					and(eq(playlistTracks.playlistId, playlistId), isNull(playlistTracks.deletedAt))
				)
				.orderBy(asc(playlistTracks.positionFrac), asc(playlistTracks.id));
			return rows;
		},

		findPlaylistTrack: async ({ playlistId, trackId }) => {
			const rows = await db
				.select()
				.from(playlistTracks)
				.where(
					and(
						eq(playlistTracks.playlistId, playlistId),
						eq(playlistTracks.trackId, trackId),
						isNull(playlistTracks.deletedAt)
					)
				)
				.limit(1);
			return rows[0] ?? null;
		},

		findTrack: async (trackId, tenantId) => {
			const rows = await db
				.select()
				.from(tracks)
				.where(and(eq(tracks.id, trackId), eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)))
				.limit(1);
			return rows[0] ?? null;
		},

		insertPlaylistTrack: async (input) => {
			const id = `plt_${crypto.randomUUID()}`;
			await db.insert(playlistTracks).values({
				id,
				playlistId: input.playlistId,
				trackId: input.trackId,
				positionFrac: input.positionFrac,
				addedAt: input.now
			});
			const rows = await db
				.select()
				.from(playlistTracks)
				.where(eq(playlistTracks.id, id))
				.limit(1);
			return rows[0]!;
		},

		setPositions: async (input) => {
			for (const u of input.updates) {
				await db
					.update(playlistTracks)
					.set({ positionFrac: u.positionFrac })
					.where(
						and(
							eq(playlistTracks.id, u.id),
							eq(playlistTracks.playlistId, input.playlistId),
							isNull(playlistTracks.deletedAt)
						)
					);
			}
		},

		softDeletePlaylistTrack: async (input) => {
			const rows = await db
				.update(playlistTracks)
				.set({ deletedAt: input.now })
				.where(
					and(
						eq(playlistTracks.playlistId, input.playlistId),
						eq(playlistTracks.trackId, input.trackId),
						isNull(playlistTracks.deletedAt)
					)
				)
				.returning();
			return rows[0] ?? null;
		},

		touchPlaylist: async (input) => {
			await db
				.update(playlists)
				.set({ updatedAt: input.now })
				.where(
					and(
						eq(playlists.id, input.playlistId),
						eq(playlists.tenantId, input.tenantId),
						isNull(playlists.deletedAt)
					)
				);
		}
	};
}

function encodeCursor(data: CursorData): string {
	return btoa(JSON.stringify(data));
}

function decodeCursor(cursor: string): CursorData {
	return JSON.parse(atob(cursor));
}

function columnForSortField(field: PlaylistSortField) {
	switch (field) {
		case 'name':
			return playlists.name;
		case 'createdAt':
			return playlists.createdAt;
		case 'updatedAt':
			return playlists.updatedAt;
	}
}

function cursorSortValue(row: PlaylistRow, field: PlaylistSortField): string | number {
	switch (field) {
		case 'name':
			return row.name;
		case 'createdAt':
			return row.createdAt.getTime();
		case 'updatedAt':
			return row.updatedAt.getTime();
	}
}

function buildCursorCondition(
	input: Pick<ListPlaylistsInput, 'cursor' | 'sortField' | 'sortDir'>
): ReturnType<typeof and> | null {
	if (!input.cursor) return null;
	const data = decodeCursor(input.cursor);
	const col = columnForSortField(input.sortField) as never;
	const value = data.value as never;
	if (input.sortDir === 'asc') {
		return or(gt(col, value), and(eq(col, value), gte(playlists.id, data.id))!)!;
	}
	return or(lt(col, value), and(eq(col, value), lte(playlists.id, data.id))!)!;
}
