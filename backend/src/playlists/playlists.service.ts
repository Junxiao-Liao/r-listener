import type { Db } from '../db';
import { apiError } from '../http/api-error';
import { createId } from '../shared/id';
import type { Id } from '../shared/shared.type';
import type { TrackStatus } from '../tracks/tracks.type';
import {
	buildPlaylistTrackList,
	toPlaylistDto,
	type AddPlaylistTrackInput,
	type CreatePlaylistInput,
	type MovePlaylistTrackInput,
	type PlaylistQuery,
	type PlaylistTracksQuery,
	type UpdatePlaylistInput
} from './playlists.dto';
import {
	createPlaylistsRepository,
	type PlaylistAggregate,
	type PlaylistsRepository
} from './playlists.repository';
import type { PlaylistDto, PlaylistTrackDto } from './playlists.type';

const RENORMALIZE_THRESHOLD = 1e-6;

export type ScopedTenantInput = {
	tenantId: Id<'tenant'>;
};

export type ListPlaylistsServiceInput = ScopedTenantInput & {
	query: PlaylistQuery;
};

export type ListPlaylistsServiceResult = {
	items: PlaylistDto[];
	nextCursor: string | null;
};

export type GetPlaylistInput = ScopedTenantInput & {
	playlistId: Id<'playlist'>;
};

export type CreatePlaylistServiceInput = ScopedTenantInput & {
	ownerId: Id<'user'>;
	input: CreatePlaylistInput;
};

export type UpdatePlaylistServiceInput = ScopedTenantInput & {
	playlistId: Id<'playlist'>;
	input: UpdatePlaylistInput;
};

export type DeletePlaylistInput = ScopedTenantInput & {
	playlistId: Id<'playlist'>;
};

export type ListPlaylistTracksServiceInput = ScopedTenantInput & {
	playlistId: Id<'playlist'>;
	query?: PlaylistTracksQuery;
};

export type ListPlaylistTracksServiceResult = {
	items: PlaylistTrackDto[];
	nextCursor: string | null;
};

export type AddPlaylistTrackServiceInput = ScopedTenantInput & {
	playlistId: Id<'playlist'>;
	input: AddPlaylistTrackInput;
};

export type MovePlaylistTrackServiceInput = ScopedTenantInput & {
	playlistId: Id<'playlist'>;
	trackId: Id<'track'>;
	input: MovePlaylistTrackInput;
};

export type RemovePlaylistTrackServiceInput = ScopedTenantInput & {
	playlistId: Id<'playlist'>;
	trackId: Id<'track'>;
};

export type PlaylistsService = {
	listPlaylists(input: ListPlaylistsServiceInput): Promise<ListPlaylistsServiceResult>;
	getPlaylist(input: GetPlaylistInput): Promise<PlaylistDto>;
	createPlaylist(input: CreatePlaylistServiceInput): Promise<PlaylistDto>;
	updatePlaylist(input: UpdatePlaylistServiceInput): Promise<PlaylistDto>;
	deletePlaylist(input: DeletePlaylistInput): Promise<void>;
	listTracks(input: ListPlaylistTracksServiceInput): Promise<ListPlaylistTracksServiceResult>;
	addTrack(input: AddPlaylistTrackServiceInput): Promise<PlaylistTrackDto>;
	moveTrack(input: MovePlaylistTrackServiceInput): Promise<PlaylistTrackDto>;
	removeTrack(input: RemovePlaylistTrackServiceInput): Promise<void>;
};

export type PlaylistsServiceDependencies = {
	playlistsRepository: PlaylistsRepository;
	now?: () => Date;
};

export function createPlaylistsService(deps: PlaylistsServiceDependencies): PlaylistsService {
	const now = deps.now ?? (() => new Date());

	function dto(agg: PlaylistAggregate): PlaylistDto {
		return toPlaylistDto(agg.row, agg.trackCount, agg.totalDurationMs);
	}

	async function ensurePlaylist(tenantId: Id<'tenant'>, playlistId: Id<'playlist'>) {
		const existing = await deps.playlistsRepository.findPlaylist({ tenantId, playlistId });
		if (!existing) {
			throw apiError(404, 'playlist_not_found', 'Playlist not found.');
		}
		return existing;
	}

	async function ensureNoNameConflict(
		tenantId: Id<'tenant'>,
		name: string,
		excludeId?: Id<'playlist'>
	) {
		const dup = await deps.playlistsRepository.findPlaylistByName({
			tenantId,
			name,
			excludeId
		});
		if (dup) {
			throw apiError(409, 'playlist_name_conflict', 'A playlist with this name already exists.');
		}
	}

	async function renumberDense(
		playlistId: Id<'playlist'>,
		ordered: Array<{ id: string }>
	) {
		await deps.playlistsRepository.setPositions({
			playlistId,
			updates: ordered.map((row, i) => ({ id: row.id, positionFrac: i + 1 }))
		});
	}

	return {
		listPlaylists: async (input) => {
			const [field, dir] = input.query.sort.split(':') as [string, string];
			const result = await deps.playlistsRepository.listPlaylists({
				tenantId: input.tenantId,
				cursor: input.query.cursor,
				limit: input.query.limit,
				sortField: field as never,
				sortDir: dir as never,
				q: input.query.q || undefined
			});
			return {
				items: result.items.map(dto),
				nextCursor: result.nextCursor
			};
		},

		getPlaylist: async (input) => {
			const existing = await ensurePlaylist(input.tenantId, input.playlistId);
			return dto(existing);
		},

		createPlaylist: async (input) => {
			await ensureNoNameConflict(input.tenantId, input.input.name);
			const id = createId('pl_') as Id<'playlist'>;
			const agg = await deps.playlistsRepository.insertPlaylist({
				id,
				tenantId: input.tenantId,
				ownerId: input.ownerId,
				name: input.input.name,
				description: input.input.description ?? null,
				now: now()
			});
			return dto(agg);
		},

		updatePlaylist: async (input) => {
			const existing = await ensurePlaylist(input.tenantId, input.playlistId);
			if (input.input.name !== undefined && input.input.name !== existing.row.name) {
				await ensureNoNameConflict(input.tenantId, input.input.name, input.playlistId);
			}
			const updated = await deps.playlistsRepository.updatePlaylist({
				tenantId: input.tenantId,
				playlistId: input.playlistId,
				set: input.input,
				now: now()
			});
			if (!updated) {
				throw apiError(404, 'playlist_not_found', 'Playlist not found.');
			}
			return dto(updated);
		},

		deletePlaylist: async (input) => {
			const deleted = await deps.playlistsRepository.softDeletePlaylist({
				tenantId: input.tenantId,
				playlistId: input.playlistId,
				now: now()
			});
			if (!deleted) {
				throw apiError(404, 'playlist_not_found', 'Playlist not found.');
			}
		},

		listTracks: async (input) => {
			await ensurePlaylist(input.tenantId, input.playlistId);
			const rows = await deps.playlistsRepository.listPlaylistTracks({
				playlistId: input.playlistId
			});
			return {
				items: buildPlaylistTrackList(rows),
				nextCursor: null
			};
		},

		addTrack: async (input) => {
			await ensurePlaylist(input.tenantId, input.playlistId);

			const track = await deps.playlistsRepository.findTrack(
				input.input.trackId as Id<'track'>,
				input.tenantId
			);
			if (!track) throw apiError(404, 'track_not_found', 'Track not found.');
			if ((track.status as TrackStatus) !== 'ready') {
				throw apiError(409, 'track_not_ready', 'Track is not ready.');
			}

			const existing = await deps.playlistsRepository.findPlaylistTrack({
				playlistId: input.playlistId,
				trackId: input.input.trackId as Id<'track'>
			});
			if (existing) {
				throw apiError(
					409,
					'track_already_in_playlist',
					'Track is already in this playlist.'
				);
			}

			const stamp = now();
			const allRows = await deps.playlistsRepository.listAllPlaylistTrackRows({
				playlistId: input.playlistId
			});

			const insertAt =
				input.input.position === null || input.input.position === undefined
					? allRows.length
					: Math.max(0, Math.min(allRows.length, input.input.position - 1));

			const positionFrac = computeMidpoint(allRows, insertAt);

			const inserted = await deps.playlistsRepository.insertPlaylistTrack({
				playlistId: input.playlistId,
				trackId: input.input.trackId as Id<'track'>,
				positionFrac,
				now: stamp
			});

			await maybeRenormalize(deps.playlistsRepository, input.playlistId, allRows, positionFrac);
			await deps.playlistsRepository.touchPlaylist({
				tenantId: input.tenantId,
				playlistId: input.playlistId,
				now: stamp
			});

			const refreshed = await deps.playlistsRepository.listPlaylistTracks({
				playlistId: input.playlistId
			});
			const dtos = buildPlaylistTrackList(refreshed);
			const own = dtos.find((d) => d.trackId === inserted.trackId);
			return own ?? dtos[dtos.length - 1]!;
		},

		moveTrack: async (input) => {
			await ensurePlaylist(input.tenantId, input.playlistId);
			const existing = await deps.playlistsRepository.findPlaylistTrack({
				playlistId: input.playlistId,
				trackId: input.trackId
			});
			if (!existing) {
				throw apiError(404, 'playlist_track_not_found', 'Playlist track not found.');
			}

			const allRows = await deps.playlistsRepository.listAllPlaylistTrackRows({
				playlistId: input.playlistId
			});
			const others = allRows.filter((r) => r.id !== existing.id);
			const targetIdx = Math.max(0, Math.min(others.length, input.input.position - 1));
			const orderedIds = [
				...others.slice(0, targetIdx).map((r) => ({ id: r.id })),
				{ id: existing.id },
				...others.slice(targetIdx).map((r) => ({ id: r.id }))
			];

			await renumberDense(input.playlistId, orderedIds);
			await deps.playlistsRepository.touchPlaylist({
				tenantId: input.tenantId,
				playlistId: input.playlistId,
				now: now()
			});

			const refreshed = await deps.playlistsRepository.listPlaylistTracks({
				playlistId: input.playlistId
			});
			const dtos = buildPlaylistTrackList(refreshed);
			const own = dtos.find((d) => d.trackId === input.trackId);
			if (!own) {
				throw apiError(404, 'playlist_track_not_found', 'Playlist track not found.');
			}
			return own;
		},

		removeTrack: async (input) => {
			await ensurePlaylist(input.tenantId, input.playlistId);
			const stamp = now();
			const removed = await deps.playlistsRepository.softDeletePlaylistTrack({
				playlistId: input.playlistId,
				trackId: input.trackId,
				now: stamp
			});
			if (!removed) {
				throw apiError(404, 'playlist_track_not_found', 'Playlist track not found.');
			}

			const remaining = await deps.playlistsRepository.listAllPlaylistTrackRows({
				playlistId: input.playlistId
			});
			await renumberDense(input.playlistId, remaining);
			await deps.playlistsRepository.touchPlaylist({
				tenantId: input.tenantId,
				playlistId: input.playlistId,
				now: stamp
			});
		}
	};
}

function computeMidpoint(
	rows: Array<{ positionFrac: number }>,
	insertAt: number
): number {
	if (rows.length === 0) return 1;
	if (insertAt <= 0) return rows[0]!.positionFrac / 2;
	if (insertAt >= rows.length) return rows[rows.length - 1]!.positionFrac + 1;
	const prev = rows[insertAt - 1]!.positionFrac;
	const next = rows[insertAt]!.positionFrac;
	return (prev + next) / 2;
}

async function maybeRenormalize(
	repo: PlaylistsRepository,
	playlistId: Id<'playlist'>,
	priorRows: Array<{ id: string; positionFrac: number }>,
	insertedFrac: number
) {
	// If the new fraction is too close to a neighbor, redistribute densely.
	const sorted = [...priorRows].sort((a, b) => a.positionFrac - b.positionFrac);
	for (let i = 0; i < sorted.length; i += 1) {
		const a = sorted[i]!.positionFrac;
		if (Math.abs(a - insertedFrac) < RENORMALIZE_THRESHOLD) {
			const refreshed = await repo.listAllPlaylistTrackRows({ playlistId });
			await repo.setPositions({
				playlistId,
				updates: refreshed.map((row, idx) => ({ id: row.id, positionFrac: idx + 1 }))
			});
			return;
		}
	}
}

export function createPlaylistsServiceForDb(db: Db, kv?: KVNamespace): PlaylistsService {
	return createPlaylistsService({ playlistsRepository: createPlaylistsRepository(db, kv) });
}
