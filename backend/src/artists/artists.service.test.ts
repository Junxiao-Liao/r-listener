import { describe, expect, it } from 'vitest';
import type { Id } from '../shared/shared.type';
import type { ArtistDto, ListArtistsResult, ArtistAggregateDto, ArtistTrackListResult } from './artists.type';
import type { ArtistsRepository } from './artists.repository';
import { createArtistsService } from './artists.service';
import type { TrackDto, TrackStatus } from '../tracks/tracks.type';
import type { artists } from './artists.orm';

describe('artists service', () => {
	describe('getArtist', () => {
		it('returns artist aggregate when found', async () => {
			const repo = createFakeRepo();
			repo.setArtistData('art_a', 'tnt_a', { trackCount: 3, totalDurationMs: 600000 });
			const service = createArtistsService({ artistsRepository: repo });

			const result = await service.getArtist({ tenantId: tid('tnt_a'), artistId: aid('art_a') });

			expect(result).toMatchObject({
				id: 'art_a',
				name: 'Test Artist art_a',
				trackCount: 3,
				totalDurationMs: 600000
			});
		});

		it('throws 404 when artist not found', async () => {
			const repo = createFakeRepo();
			const service = createArtistsService({ artistsRepository: repo });

			await expect(
				service.getArtist({ tenantId: tid('tnt_a'), artistId: aid('missing') })
			).rejects.toMatchObject({ status: 404, code: 'artist_not_found' });
		});

		it('throws 404 for wrong tenant', async () => {
			const repo = createFakeRepo();
			repo.setArtistData('art_a', 'tnt_a', { trackCount: 0, totalDurationMs: 0 });
			const service = createArtistsService({ artistsRepository: repo });

			await expect(
				service.getArtist({ tenantId: tid('tnt_b'), artistId: aid('art_a') })
			).rejects.toMatchObject({ status: 404, code: 'artist_not_found' });
		});
	});

	describe('listArtistTracks', () => {
		it('returns tracks for an artist', async () => {
			const repo = createFakeRepo();
			repo.setArtistData('art_a', 'tnt_a', { trackCount: 1, totalDurationMs: 180000 });
			repo.setArtistTracks('art_a', 'tnt_a', [
				makeTrackDto({ id: 'trk_a' as Id<'track'>, title: 'Song A' })
			]);
			const service = createArtistsService({ artistsRepository: repo });

			const result = await service.listArtistTracks({ tenantId: tid('tnt_a'), artistId: aid('art_a') });

			expect(result.items).toHaveLength(1);
			expect(result.items[0]!.title).toBe('Song A');
		});

		it('throws 404 when artist not found', async () => {
			const repo = createFakeRepo();
			const service = createArtistsService({ artistsRepository: repo });

			await expect(
				service.listArtistTracks({ tenantId: tid('tnt_a'), artistId: aid('missing') })
			).rejects.toMatchObject({ status: 404, code: 'artist_not_found' });
		});
	});
});

function aid(value: string): Id<'artist'> {
	return value as Id<'artist'>;
}

function tid(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}

function makeTrackDto(overrides: Partial<TrackDto> = {}): TrackDto {
	return {
		id: 'trk_a' as Id<'track'>,
		tenantId: 'tnt_a' as Id<'tenant'>,
		title: 'Track',
		artists: [],
		album: null,
		trackNumber: null,
		genre: null,
		year: null,
		durationMs: 180000,
		coverUrl: null,
		lyricsLrc: null,
		lyricsStatus: 'none',
		contentType: 'audio/mpeg',
		sizeBytes: 1024,
		status: 'ready',
		createdAt: '2026-05-02T00:00:00.000Z' as TrackDto['createdAt'],
		updatedAt: '2026-05-02T00:00:00.000Z' as TrackDto['updatedAt'],
		...overrides
	};
}

interface FakeArtist {
	id: Id<'artist'>;
	tenantId: Id<'tenant'>;
	name: string;
	nameKey: string;
	agg: { trackCount: number; totalDurationMs: number } | null;
	tracks: TrackDto[];
}

function createFakeRepo(): ArtistsRepository & {
	setArtistData(id: string, tenantId: string, agg: { trackCount: number; totalDurationMs: number }): void;
	setArtistTracks(id: string, tenantId: string, tracks: TrackDto[]): void;
} {
	const store = new Map<string, FakeArtist>();

	function key(id: string, tenantId: string): string {
		return `${tenantId}:${id}`;
	}

	const repo: ArtistsRepository & {
		setArtistData: (id: string, tenantId: string, agg: { trackCount: number; totalDurationMs: number }) => void;
		setArtistTracks: (id: string, tenantId: string, tracks: TrackDto[]) => void;
	} = {
		setArtistData(id: string, tenantId: string, agg: { trackCount: number; totalDurationMs: number }) {
			const k = key(id, tenantId);
			const existing = store.get(k);
			store.set(k, {
				id: id as Id<'artist'>,
				tenantId: tenantId as Id<'tenant'>,
				name: `Test Artist ${id}`,
				nameKey: `test artist ${id}`,
				agg,
				tracks: existing?.tracks ?? []
			});
		},

		setArtistTracks(id: string, tenantId: string, tracks: TrackDto[]) {
			const k = key(id, tenantId);
			const existing = store.get(k);
			store.set(k, {
				id: id as Id<'artist'>,
				tenantId: tenantId as Id<'tenant'>,
				name: `Test Artist ${id}`,
				nameKey: `test artist ${id}`,
				agg: existing?.agg ?? null,
				tracks
			});
		},

		listArtists: async () => ({ items: [], nextCursor: null }),

		findArtist: async ({ tenantId, artistId }) => {
			const entry = store.get(key(artistId, tenantId));
			if (!entry || !entry.agg) return null;
			return {
				id: entry.id,
				name: entry.name,
				trackCount: entry.agg.trackCount,
				totalDurationMs: entry.agg.totalDurationMs
			};
		},

		listArtistTracks: async ({ tenantId, artistId }) => {
			const entry = store.get(key(artistId, tenantId));
			return { items: entry?.tracks ?? [] };
		}
	};

	return repo;
}
