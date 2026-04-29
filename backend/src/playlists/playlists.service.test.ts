import { describe, expect, it } from 'vitest';
import type { Id } from '../shared/shared.type';
import type { TrackStatus } from '../tracks/tracks.type';
import type {
	PlaylistRow,
	PlaylistTrackRow,
	TrackRow
} from './playlists.dto';
import type {
	ListPlaylistsResult,
	PlaylistsRepository
} from './playlists.repository';
import { createPlaylistsService } from './playlists.service';

const FIXED_NOW = new Date('2026-04-29T12:00:00.000Z');

describe('playlists service', () => {
	describe('createPlaylist', () => {
		it('creates a playlist with name and description', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });

			const created = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning', description: 'wake up' }
			});

			expect(created.name).toBe('Morning');
			expect(created.description).toBe('wake up');
			expect(created.tenantId).toBe('tnt_a');
			expect(created.trackCount).toBe(0);
			expect(created.totalDurationMs).toBe(0);
		});

		it('rejects duplicate name within same tenant with 409 playlist_name_conflict', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });

			await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning' }
			});

			await expect(
				service.createPlaylist({
					tenantId: tid('tnt_a'),
					ownerId: uid('usr_b'),
					input: { name: 'Morning' }
				})
			).rejects.toMatchObject({ status: 409, code: 'playlist_name_conflict' });
		});

		it('allows the same name in a different tenant', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });

			await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning' }
			});

			const created = await service.createPlaylist({
				tenantId: tid('tnt_b'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning' }
			});
			expect(created.tenantId).toBe('tnt_b');
		});

		it('allows the same name as a soft-deleted playlist', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });

			const first = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning' }
			});
			await service.deletePlaylist({ tenantId: tid('tnt_a'), playlistId: first.id });

			const created = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning' }
			});
			expect(created.name).toBe('Morning');
		});
	});

	describe('updatePlaylist', () => {
		it('renames the playlist', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const created = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning' }
			});

			const updated = await service.updatePlaylist({
				tenantId: tid('tnt_a'),
				playlistId: created.id,
				input: { name: 'Evening' }
			});

			expect(updated.name).toBe('Evening');
		});

		it('updates description (clears with null)', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const created = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning', description: 'wake up' }
			});

			const updated = await service.updatePlaylist({
				tenantId: tid('tnt_a'),
				playlistId: created.id,
				input: { description: null }
			});
			expect(updated.description).toBeNull();
		});

		it('rejects rename to an existing name in same tenant', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning' }
			});
			const second = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Evening' }
			});

			await expect(
				service.updatePlaylist({
					tenantId: tid('tnt_a'),
					playlistId: second.id,
					input: { name: 'Morning' }
				})
			).rejects.toMatchObject({ status: 409, code: 'playlist_name_conflict' });
		});

		it('rejects unknown id with 404 playlist_not_found', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });

			await expect(
				service.updatePlaylist({
					tenantId: tid('tnt_a'),
					playlistId: 'pl_missing' as Id<'playlist'>,
					input: { name: 'X' }
				})
			).rejects.toMatchObject({ status: 404, code: 'playlist_not_found' });
		});
	});

	describe('deletePlaylist', () => {
		it('soft-deletes and hides from list', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const created = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'Morning' }
			});

			await service.deletePlaylist({ tenantId: tid('tnt_a'), playlistId: created.id });

			const list = await service.listPlaylists({
				tenantId: tid('tnt_a'),
				query: { limit: 50, sort: 'createdAt:desc' }
			});
			expect(list.items).toHaveLength(0);
		});

		it('rejects unknown id with 404 playlist_not_found', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });

			await expect(
				service.deletePlaylist({
					tenantId: tid('tnt_a'),
					playlistId: 'pl_missing' as Id<'playlist'>
				})
			).rejects.toMatchObject({ status: 404, code: 'playlist_not_found' });
		});
	});

	describe('addTrack', () => {
		it('appends to end when position is null', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b')]
			});
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_a' as Id<'track'>, position: null }
			});
			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_b' as Id<'track'>, position: null }
			});

			const tracks = await service.listTracks({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id
			});
			expect(tracks.items.map((i) => i.trackId)).toEqual(['trk_a', 'trk_b']);
			expect(tracks.items.map((i) => i.position)).toEqual([1, 2]);
		});

		it('inserts at target position with dense reorder', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b'), readyTrack('trk_c')]
			});
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_a' as Id<'track'>, position: null }
			});
			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_b' as Id<'track'>, position: null }
			});
			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_c' as Id<'track'>, position: 2 }
			});

			const tracks = await service.listTracks({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id
			});
			expect(tracks.items.map((i) => i.trackId)).toEqual(['trk_a', 'trk_c', 'trk_b']);
			expect(tracks.items.map((i) => i.position)).toEqual([1, 2, 3]);
		});

		it('rejects duplicate (playlistId, trackId) with 409 track_already_in_playlist', async () => {
			const repo = createFakeRepo({ tracks: [readyTrack('trk_a')] });
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_a' as Id<'track'>, position: null }
			});

			await expect(
				service.addTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					input: { trackId: 'trk_a' as Id<'track'>, position: null }
				})
			).rejects.toMatchObject({ status: 409, code: 'track_already_in_playlist' });
		});

		it('rejects unknown track with 404 track_not_found', async () => {
			const repo = createFakeRepo({ tracks: [] });
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await expect(
				service.addTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					input: { trackId: 'trk_missing' as Id<'track'>, position: null }
				})
			).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
		});

		it('rejects pending track with 409 track_not_ready', async () => {
			const repo = createFakeRepo({ tracks: [pendingTrack('trk_a')] });
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await expect(
				service.addTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					input: { trackId: 'trk_a' as Id<'track'>, position: null }
				})
			).rejects.toMatchObject({ status: 409, code: 'track_not_ready' });
		});

		it('rejects wrong-tenant track with 404 track_not_found', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a', { tenantId: 'tnt_other' })]
			});
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await expect(
				service.addTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					input: { trackId: 'trk_a' as Id<'track'>, position: null }
				})
			).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
		});

		it('rejects when playlist not in tenant with 404 playlist_not_found', async () => {
			const repo = createFakeRepo({ tracks: [readyTrack('trk_a')] });
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await expect(
				service.addTrack({
					tenantId: tid('tnt_other'),
					playlistId: playlist.id,
					input: { trackId: 'trk_a' as Id<'track'>, position: null }
				})
			).rejects.toMatchObject({ status: 404, code: 'playlist_not_found' });
		});
	});

	describe('moveTrack', () => {
		it('reorders to target with dense positions', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b'), readyTrack('trk_c')]
			});
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});
			for (const id of ['trk_a', 'trk_b', 'trk_c']) {
				await service.addTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					input: { trackId: id as Id<'track'>, position: null }
				});
			}

			await service.moveTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				trackId: 'trk_c' as Id<'track'>,
				input: { position: 1 }
			});

			const tracks = await service.listTracks({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id
			});
			expect(tracks.items.map((i) => i.trackId)).toEqual(['trk_c', 'trk_a', 'trk_b']);
			expect(tracks.items.map((i) => i.position)).toEqual([1, 2, 3]);
		});

		it('clamps target position to [1, count]', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b')]
			});
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});
			for (const id of ['trk_a', 'trk_b']) {
				await service.addTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					input: { trackId: id as Id<'track'>, position: null }
				});
			}

			await service.moveTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				trackId: 'trk_a' as Id<'track'>,
				input: { position: 99 }
			});

			const tracks = await service.listTracks({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id
			});
			expect(tracks.items.map((i) => i.trackId)).toEqual(['trk_b', 'trk_a']);
		});
	});

	describe('removeTrack', () => {
		it('removes one and compacts positions', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b'), readyTrack('trk_c')]
			});
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});
			for (const id of ['trk_a', 'trk_b', 'trk_c']) {
				await service.addTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					input: { trackId: id as Id<'track'>, position: null }
				});
			}

			await service.removeTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				trackId: 'trk_b' as Id<'track'>
			});

			const tracks = await service.listTracks({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id
			});
			expect(tracks.items.map((i) => i.trackId)).toEqual(['trk_a', 'trk_c']);
			expect(tracks.items.map((i) => i.position)).toEqual([1, 2]);
		});

		it('rejects unknown (playlistId, trackId) with 404 playlist_track_not_found', async () => {
			const repo = createFakeRepo({ tracks: [readyTrack('trk_a')] });
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await expect(
				service.removeTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					trackId: 'trk_a' as Id<'track'>
				})
			).rejects.toMatchObject({ status: 404, code: 'playlist_track_not_found' });
		});

		it('after a track is removed, it can be re-added', async () => {
			const repo = createFakeRepo({ tracks: [readyTrack('trk_a')] });
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});

			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_a' as Id<'track'>, position: null }
			});
			await service.removeTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				trackId: 'trk_a' as Id<'track'>
			});
			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_a' as Id<'track'>, position: null }
			});

			const tracks = await service.listTracks({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id
			});
			expect(tracks.items.map((i) => i.trackId)).toEqual(['trk_a']);
		});
	});

	describe('aggregates', () => {
		it('listPlaylists computes trackCount and totalDurationMs from ready tracks only', async () => {
			const repo = createFakeRepo({
				tracks: [
					readyTrack('trk_a', { durationMs: 1000 }),
					readyTrack('trk_b', { durationMs: 2000 }),
					pendingTrack('trk_p', { durationMs: 9999 })
				]
			});
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});
			for (const id of ['trk_a', 'trk_b']) {
				await service.addTrack({
					tenantId: tid('tnt_a'),
					playlistId: playlist.id,
					input: { trackId: id as Id<'track'>, position: null }
				});
			}

			const list = await service.listPlaylists({
				tenantId: tid('tnt_a'),
				query: { limit: 50, sort: 'createdAt:desc' }
			});
			expect(list.items).toHaveLength(1);
			expect(list.items[0]!.trackCount).toBe(2);
			expect(list.items[0]!.totalDurationMs).toBe(3000);
		});

		it('listTracks excludes soft-deleted tracks from result', async () => {
			const repo = createFakeRepo({
				tracks: [readyTrack('trk_a'), readyTrack('trk_b')]
			});
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			const playlist = await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'P' }
			});
			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_a' as Id<'track'>, position: null }
			});
			await service.addTrack({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id,
				input: { trackId: 'trk_b' as Id<'track'>, position: null }
			});

			repo._softDeleteTrack('trk_a');

			const tracks = await service.listTracks({
				tenantId: tid('tnt_a'),
				playlistId: playlist.id
			});
			expect(tracks.items.map((i) => i.trackId)).toEqual(['trk_b']);
		});
	});

	describe('tenant scoping', () => {
		it('list returns only the active tenant playlists', async () => {
			const repo = createFakeRepo();
			const service = createPlaylistsService({ playlistsRepository: repo, now: () => FIXED_NOW });
			await service.createPlaylist({
				tenantId: tid('tnt_a'),
				ownerId: uid('usr_a'),
				input: { name: 'A' }
			});
			await service.createPlaylist({
				tenantId: tid('tnt_b'),
				ownerId: uid('usr_a'),
				input: { name: 'B' }
			});

			const list = await service.listPlaylists({
				tenantId: tid('tnt_a'),
				query: { limit: 50, sort: 'createdAt:desc' }
			});
			expect(list.items.map((p) => p.name)).toEqual(['A']);
		});
	});
});

type FakeRepoOptions = {
	tracks?: TrackRow[];
};

type FakeRepo = PlaylistsRepository & {
	_softDeleteTrack(trackId: string): void;
};

function createFakeRepo(options: FakeRepoOptions = {}): FakeRepo {
	const playlists: PlaylistRow[] = [];
	const playlistTracks: PlaylistTrackRow[] = [];
	const tracksMap = new Map<string, TrackRow>();
	for (const t of options.tracks ?? []) tracksMap.set(`${t.tenantId}:${t.id}`, t);
	let idCounter = 0;

	function trackKey(trackId: string, tenantId: string) {
		return `${tenantId}:${trackId}`;
	}

	function nextId(prefix: string): string {
		idCounter += 1;
		return `${prefix}${idCounter}`;
	}

	function alivePlaylistTracks(playlistId: string): PlaylistTrackRow[] {
		return playlistTracks
			.filter((pt) => pt.playlistId === playlistId && pt.deletedAt === null)
			.sort((a, b) => a.positionFrac - b.positionFrac);
	}

	function aggregate(playlist: PlaylistRow): { trackCount: number; totalDurationMs: number } {
		const rows = alivePlaylistTracks(playlist.id);
		let count = 0;
		let total = 0;
		for (const pt of rows) {
			const track = tracksMap.get(trackKey(pt.trackId, playlist.tenantId));
			if (!track) continue;
			if (track.status !== 'ready') continue;
			if (track.deletedAt !== null) continue;
			count += 1;
			total += track.durationMs ?? 0;
		}
		return { trackCount: count, totalDurationMs: total };
	}

	const repo: FakeRepo = {
		_softDeleteTrack(trackId: string) {
			for (const t of tracksMap.values()) {
				if (t.id === trackId) t.deletedAt = new Date();
			}
		},

		listPlaylists: async (input): Promise<ListPlaylistsResult> => {
			const items = playlists
				.filter((p) => p.tenantId === input.tenantId && p.deletedAt === null)
				.filter((p) => {
					if (!input.q) return true;
					const haystack = `${p.name} ${p.description ?? ''}`.toLowerCase();
					return haystack.includes(input.q.toLowerCase());
				});
			items.sort((a, b) => {
				const av = sortValue(a, input.sortField);
				const bv = sortValue(b, input.sortField);
				if (av < bv) return input.sortDir === 'asc' ? -1 : 1;
				if (av > bv) return input.sortDir === 'asc' ? 1 : -1;
				return 0;
			});
			return {
				items: items.map((p) => ({ row: p, ...aggregate(p) })),
				nextCursor: null
			};
		},

		findPlaylist: async ({ tenantId, playlistId }) => {
			const p = playlists.find(
				(pl) => pl.id === playlistId && pl.tenantId === tenantId && pl.deletedAt === null
			);
			return p ? { row: p, ...aggregate(p) } : null;
		},

		findPlaylistByName: async ({ tenantId, name, excludeId }) => {
			const p = playlists.find(
				(pl) =>
					pl.tenantId === tenantId &&
					pl.deletedAt === null &&
					pl.name === name &&
					(!excludeId || pl.id !== excludeId)
			);
			return p ?? null;
		},

		insertPlaylist: async (input) => {
			const row: PlaylistRow = {
				id: input.id,
				tenantId: input.tenantId,
				ownerId: input.ownerId,
				name: input.name,
				description: input.description,
				createdAt: input.now,
				updatedAt: input.now,
				deletedAt: null
			};
			playlists.push(row);
			return { row, trackCount: 0, totalDurationMs: 0 };
		},

		updatePlaylist: async (input) => {
			const target = playlists.find(
				(p) => p.id === input.playlistId && p.tenantId === input.tenantId && p.deletedAt === null
			);
			if (!target) return null;
			if (input.set.name !== undefined) target.name = input.set.name;
			if (input.set.description !== undefined) target.description = input.set.description;
			target.updatedAt = input.now;
			return { row: target, ...aggregate(target) };
		},

		softDeletePlaylist: async (input) => {
			const target = playlists.find(
				(p) => p.id === input.playlistId && p.tenantId === input.tenantId && p.deletedAt === null
			);
			if (!target) return null;
			target.deletedAt = input.now;
			target.updatedAt = input.now;
			return target;
		},

		listPlaylistTracks: async ({ playlistId }) => {
			const rows = alivePlaylistTracks(playlistId);
			return rows
				.map((row) => {
					const track = tracksMap.get(trackKey(row.trackId, getPlaylistTenant(row.playlistId) ?? ''));
					if (!track) return null;
					if (track.deletedAt !== null) return null;
					if (track.status !== 'ready') return null;
					return { row, track };
				})
				.filter((v): v is { row: PlaylistTrackRow; track: TrackRow } => v !== null);
		},

		listAllPlaylistTrackRows: async ({ playlistId }) => {
			return alivePlaylistTracks(playlistId);
		},

		findPlaylistTrack: async ({ playlistId, trackId }) => {
			return (
				playlistTracks.find(
					(pt) =>
						pt.playlistId === playlistId && pt.trackId === trackId && pt.deletedAt === null
				) ?? null
			);
		},

		findTrack: async (trackId, tenantId) => {
			return tracksMap.get(trackKey(trackId, tenantId)) ?? null;
		},

		insertPlaylistTrack: async (input) => {
			const row: PlaylistTrackRow = {
				id: nextId('plt_'),
				playlistId: input.playlistId,
				trackId: input.trackId,
				positionFrac: input.positionFrac,
				addedAt: input.now,
				deletedAt: null
			};
			playlistTracks.push(row);
			return row;
		},

		setPositions: async (input) => {
			for (const u of input.updates) {
				const target = playlistTracks.find(
					(pt) => pt.id === u.id && pt.playlistId === input.playlistId && pt.deletedAt === null
				);
				if (target) target.positionFrac = u.positionFrac;
			}
		},

		softDeletePlaylistTrack: async (input) => {
			const target = playlistTracks.find(
				(pt) =>
					pt.playlistId === input.playlistId &&
					pt.trackId === input.trackId &&
					pt.deletedAt === null
			);
			if (!target) return null;
			target.deletedAt = input.now;
			return target;
		},

		touchPlaylist: async (input) => {
			const target = playlists.find(
				(p) => p.id === input.playlistId && p.tenantId === input.tenantId && p.deletedAt === null
			);
			if (target) target.updatedAt = input.now;
		}
	};

	function getPlaylistTenant(playlistId: string): string | null {
		return playlists.find((p) => p.id === playlistId)?.tenantId ?? null;
	}

	return repo;
}

function sortValue(row: PlaylistRow, field: string): string | number {
	switch (field) {
		case 'name':
			return row.name;
		case 'updatedAt':
			return row.updatedAt.getTime();
		case 'createdAt':
		default:
			return row.createdAt.getTime();
	}
}

function readyTrack(id: string, opts: { tenantId?: string; durationMs?: number } = {}): TrackRow {
	return makeTrackRow(id, opts.tenantId ?? 'tnt_a', 'ready', opts.durationMs ?? 180000);
}

function pendingTrack(id: string, opts: { tenantId?: string; durationMs?: number } = {}): TrackRow {
	return makeTrackRow(id, opts.tenantId ?? 'tnt_a', 'pending', opts.durationMs ?? 180000);
}

function makeTrackRow(
	id: string,
	tenantId: string,
	status: TrackStatus,
	durationMs: number
): TrackRow {
	return {
		id,
		tenantId,
		uploaderId: 'usr_a',
		title: id,
		artist: null,
		album: null,
		durationMs,
		contentType: 'audio/mpeg',
		sizeBytes: 1024,
		trackNumber: null,
		genre: null,
		year: null,
		lyricsLrc: null,
		lyricsStatus: 'none',
		audioR2Key: `tenants/${tenantId}/tracks/${id}.mp3`,
		coverR2Key: null,
		status,
		createdAt: new Date('2026-04-26T00:00:00.000Z'),
		updatedAt: new Date('2026-04-26T00:00:00.000Z'),
		deletedAt: null
	};
}

function uid(value: string): Id<'user'> {
	return value as Id<'user'>;
}
function tid(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}
