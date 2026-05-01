import { describe, expect, it } from 'vitest';
import type { Id, Iso8601 } from '../shared/shared.type';
import type { PlaylistDto } from '../playlists/playlists.type';
import type { TrackDto } from '../tracks/tracks.type';
import { rankSearchCandidates, type SearchCandidate } from './search.repository';

const BASE_TIME = '2026-04-29T12:00:00.000Z' as Iso8601;

describe('search ranking', () => {
	it('ranks prefix matches ahead of substring matches', () => {
		const result = rankSearchCandidates({
			tenantId: tid('tnt_a'),
			q: 'sun',
			kinds: ['track', 'playlist'],
			limit: 10,
			candidates: [
				trackCandidate(track({ id: tkid('trk_sub'), title: 'Blue Sun' })),
				trackCandidate(track({ id: tkid('trk_prefix_old'), title: 'Sunrise', updatedAt: iso('2026-01-01') })),
				playlistCandidate(playlist({ id: plid('pl_prefix_new'), name: 'Sunny Mix', updatedAt: iso('2026-04-01') }))
			]
		});

		expect(result.items.map((item) => (item.kind === 'track' ? item.track.id : item.playlist.id))).toEqual([
			'pl_prefix_new',
			'trk_prefix_old',
			'trk_sub'
		]);
	});

	it('omits wrong-tenant, pending, and soft-deleted resources', () => {
		const result = rankSearchCandidates({
			tenantId: tid('tnt_a'),
			q: 'sun',
			kinds: ['track', 'playlist'],
			limit: 10,
			candidates: [
				trackCandidate(track({ id: tkid('trk_visible'), title: 'Sunrise' })),
				trackCandidate(track({ id: tkid('trk_tenant'), tenantId: tid('tnt_b'), title: 'Sunset' })),
				trackCandidate(track({ id: tkid('trk_pending'), title: 'Sun Beam', status: 'pending' })),
				trackCandidate(track({ id: tkid('trk_deleted'), title: 'Sun Ray' }), new Date()),
				playlistCandidate(playlist({ id: plid('pl_deleted'), name: 'Sun Mix' }), new Date())
			]
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({ kind: 'track', track: { id: 'trk_visible' } });
	});

	it('filters by requested kinds', () => {
		const result = rankSearchCandidates({
			tenantId: tid('tnt_a'),
			q: 'sun',
			kinds: ['playlist'],
			limit: 10,
			candidates: [
				trackCandidate(track({ id: tkid('trk_visible'), title: 'Sunrise' })),
				playlistCandidate(playlist({ id: plid('pl_visible'), name: 'Sun Mix' }))
			]
		});

		expect(result.items).toEqual([
			expect.objectContaining({ kind: 'playlist', playlist: expect.objectContaining({ id: 'pl_visible' }) })
		]);
	});
});

function trackCandidate(track: TrackDto, deletedAt: Date | null = null): SearchCandidate {
	return {
		kind: 'track',
		tenantId: track.tenantId,
		status: track.status,
		deletedAt,
		updatedAt: new Date(track.updatedAt),
		primaryText: track.title,
		texts: [track.title, ...track.artists.map((artist) => artist.name), track.album],
		hit: { kind: 'track', track }
	};
}

function playlistCandidate(playlist: PlaylistDto, deletedAt: Date | null = null): SearchCandidate {
	return {
		kind: 'playlist',
		tenantId: playlist.tenantId,
		deletedAt,
		updatedAt: new Date(playlist.updatedAt),
		primaryText: playlist.name,
		texts: [playlist.name, playlist.description],
		hit: { kind: 'playlist', playlist }
	};
}

function track(overrides: Partial<TrackDto> = {}): TrackDto {
	return {
		id: 'trk_a' as Id<'track'>,
		tenantId: tid('tnt_a'),
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
		createdAt: BASE_TIME,
		updatedAt: BASE_TIME,
		...overrides
	};
}

function playlist(overrides: Partial<PlaylistDto> = {}): PlaylistDto {
	return {
		id: 'pl_a' as Id<'playlist'>,
		tenantId: tid('tnt_a'),
		name: 'Playlist',
		description: null,
		trackCount: 0,
		totalDurationMs: 0,
		createdAt: BASE_TIME,
		updatedAt: BASE_TIME,
		...overrides
	};
}

function tid(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}

function tkid(value: string): Id<'track'> {
	return value as Id<'track'>;
}

function plid(value: string): Id<'playlist'> {
	return value as Id<'playlist'>;
}

function iso(value: string): Iso8601 {
	return `${value}T00:00:00.000Z` as Iso8601;
}
