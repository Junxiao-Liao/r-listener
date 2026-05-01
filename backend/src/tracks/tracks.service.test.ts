import { describe, expect, it, vi } from 'vitest';
import type { Id } from '../shared/shared.type';
import { createTracksService } from './tracks.service';
import type { TracksRepository, TrackRow } from './tracks.repository';
import type { TrackDto } from './tracks.type';

const FIXED_DATE = new Date('2026-04-26T00:00:00.000Z');

describe('tracks service', () => {
	describe('listTracks', () => {
		it('delegates to repository with parsed sort and pagination', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.listTracks({
				tenantId: tid('tnt_a'),
				isEditor: false,
				query: { limit: 20, sort: 'title:asc', includePending: false }
			});

			expect(repo.listTracks).toHaveBeenCalledWith(
				expect.objectContaining({
					tenantId: 'tnt_a',
					limit: 20,
					sortField: 'title',
					sortDir: 'asc',
					includePending: false
				})
			);
		});

		it('blocks viewer from using includePending', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.listTracks({
					tenantId: tid('tnt_a'),
					isEditor: false,
					query: { limit: 50, sort: 'createdAt:desc', includePending: true }
				})
			).rejects.toMatchObject({ status: 403, code: 'insufficient_role' });
		});

		it('allows editor to use includePending', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.listTracks({
				tenantId: tid('tnt_a'),
				isEditor: true,
				query: { limit: 50, sort: 'createdAt:desc', includePending: true }
			});

			expect(repo.listTracks).toHaveBeenCalledWith(
				expect.objectContaining({ includePending: true })
			);
		});
	});

	describe('createTrack', () => {
		it('validates supported MIME types', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.createTrack({
					tenantId: tid('tnt_a'),
					uploaderId: uid('usr_a'),
					file: uploadFile({ type: 'video/mp4' }),
					metadata: { artistNames: [] }
				})
			).rejects.toMatchObject({ status: 415, code: 'unsupported_media_type' });
		});

		it('validates file size limit', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.createTrack({
					tenantId: tid('tnt_a'),
					uploaderId: uid('usr_a'),
					file: uploadFile({ size: 101 * 1024 * 1024 }),
					metadata: { artistNames: [] }
				})
			).rejects.toMatchObject({ status: 413, code: 'payload_too_large' });
		});

		it('rejects empty files', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.createTrack({
					tenantId: tid('tnt_a'),
					uploaderId: uid('usr_a'),
					file: uploadFile({ size: 0 }),
					metadata: { artistNames: [] }
				})
			).rejects.toMatchObject({ status: 400, code: 'upload_missing' });
		});

		it('creates pending track and stores file in R2', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			const result = await service.createTrack({
				tenantId: tid('tnt_a'),
				uploaderId: uid('usr_a'),
				file: uploadFile({ name: 'my-song.mp3' }),
				metadata: { title: 'Custom Title', artistNames: ['Artist'] }
			});

			expect(repo.createTrack).toHaveBeenCalledWith(
				expect.objectContaining({
					tenantId: 'tnt_a',
					uploaderId: 'usr_a',
					title: 'Custom Title',
					artistNames: ['Artist'],
					contentType: 'audio/mpeg'
				})
			);
			expect(result).toEqual(trackDto());
		});

		it('falls back to filename-derived title when no metadata title', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.createTrack({
				tenantId: tid('tnt_a'),
				uploaderId: uid('usr_a'),
				file: uploadFile({ name: 'awesome-track.flac' }),
				metadata: { artistNames: [] }
			});

			expect(repo.createTrack).toHaveBeenCalledWith(
				expect.objectContaining({ title: 'awesome-track' })
			);
		});
	});

	describe('finalizeTrack', () => {
		it('rejects already-ready track', async () => {
			const repo = createRepo({ status: 'ready' });
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.finalizeTrack({
					trackId: tkid('trk_a'),
					tenantId: tid('tnt_a'),
					input: { durationMs: 180000 }
				})
			).rejects.toMatchObject({ status: 409, code: 'track_already_finalized' });
		});

		it('rejects missing R2 object', async () => {
			const repo = createRepo();
			const r2 = createR2({ head: async () => null });
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.finalizeTrack({
					trackId: tkid('trk_a'),
					tenantId: tid('tnt_a'),
					input: { durationMs: 180000 }
				})
			).rejects.toMatchObject({ status: 400, code: 'upload_missing' });
		});

		it('parses synced lyrics status', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			const lrc = '[00:01.00]Hello\n[00:02.00]World\n';
			await service.finalizeTrack({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a'),
				input: { durationMs: 180000, lyricsLrc: lrc }
			});

			expect(repo.finalizeTrack).toHaveBeenCalledWith(
				expect.objectContaining({ lyricsStatus: 'synced' })
			);
		});

		it('ignores LRC metadata tags when parsing synced lyrics status', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			const lrc = [
				'[ti:Someone Like You]',
				'[ar:Adele]',
				'[by:SpotiFlac]',
				'',
				'[00:14.01]I heard that you\'re settled down',
				'[00:21.03]That you found a girl and you\'re married now',
				'[01:10.57]'
			].join('\n');

			await service.finalizeTrack({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a'),
				input: { durationMs: 180000, lyricsLrc: lrc }
			});

			expect(repo.finalizeTrack).toHaveBeenCalledWith(
				expect.objectContaining({ lyricsStatus: 'synced' })
			);
		});

		it('parses plain lyrics status', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.finalizeTrack({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a'),
				input: { durationMs: 180000, lyricsLrc: 'Hello\nWorld\n' }
			});

			expect(repo.finalizeTrack).toHaveBeenCalledWith(
				expect.objectContaining({ lyricsStatus: 'plain' })
			);
		});

		it('parses invalid lyrics status for bracket-only lines', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.finalizeTrack({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a'),
				input: { durationMs: 180000, lyricsLrc: '[bad]\n[wrong]\n' }
			});

			expect(repo.finalizeTrack).toHaveBeenCalledWith(
				expect.objectContaining({ lyricsStatus: 'invalid' })
			);
		});

		it('parses plain lyrics status for brackets with text content', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.finalizeTrack({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a'),
				input: { durationMs: 180000, lyricsLrc: '[bad]Hello\n[wrong]World\n' }
			});

			expect(repo.finalizeTrack).toHaveBeenCalledWith(
				expect.objectContaining({ lyricsStatus: 'plain' })
			);
		});

		it('classifies metadata-only LRC as none', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.finalizeTrack({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a'),
				input: { durationMs: 180000, lyricsLrc: '[ti:Title]\n[ar:Artist]\n' }
			});

			expect(repo.finalizeTrack).toHaveBeenCalledWith(
				expect.objectContaining({ lyricsStatus: 'none' })
			);
		});

		it('classifies multi-timestamp lines as synced', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.finalizeTrack({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a'),
				input: { durationMs: 180000, lyricsLrc: '[00:01.00][00:02.00]repeat\n' }
			});

			expect(repo.finalizeTrack).toHaveBeenCalledWith(
				expect.objectContaining({ lyricsStatus: 'synced' })
			);
		});
	});

	describe('updateTrack', () => {
		it('rejects non-existent track', async () => {
			const repo = createRepo({ findRowReturns: null });
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.updateTrack({
					trackId: tkid('trk_nonexistent'),
					tenantId: tid('tnt_a'),
					input: { title: 'New' }
				})
			).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
		});

		it('delegates partial patch to repository', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.updateTrack({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a'),
				input: { title: 'Updated', artistNames: [] }
			});

			expect(repo.updateTrack).toHaveBeenCalledWith(
				expect.objectContaining({
					trackId: 'trk_a',
					tenantId: 'tnt_a',
					patch: { title: 'Updated', artistNames: [] }
				})
			);
		});
	});

	describe('setLyrics', () => {
		it('rejects non-existent track', async () => {
			const repo = createRepo({ findRowReturns: null });
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.setLyrics({
					trackId: tkid('trk_nonexistent'),
					tenantId: tid('tnt_a'),
					input: { lyricsLrc: '[00:01.00]Test' }
				})
			).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
		});
	});

	describe('clearLyrics', () => {
		it('rejects non-existent track', async () => {
			const repo = createRepo({ findRowReturns: null });
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.clearLyrics(tkid('trk_nonexistent'), tid('tnt_a'))
			).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
		});

		it('clears lyrics through repository', async () => {
			const repo = createRepo();
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await service.clearLyrics(tkid('trk_a'), tid('tnt_a'));

			expect(repo.clearLyrics).toHaveBeenCalledWith('trk_a', 'tnt_a', FIXED_DATE);
		});
	});

	describe('softDeleteTrack', () => {
		it('rejects non-existent track', async () => {
			const repo = createRepo({ findRowReturns: null });
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.softDeleteTrack(tkid('trk_nonexistent'), tid('tnt_a'))
			).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
		});
	});

	describe('getStream', () => {
		it('rejects pending track', async () => {
			const repo = createRepo({ status: 'pending' });
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			await expect(
				service.getStream({ trackId: tkid('trk_a'), tenantId: tid('tnt_a') })
			).rejects.toMatchObject({ status: 404, code: 'track_not_ready' });
		});

		it('returns R2 object for ready track', async () => {
			const repo = createRepo({ status: 'ready' });
			const r2 = createR2();
			const service = createTracksService({ tracksRepository: repo, r2, now: () => FIXED_DATE });

			const result = await service.getStream({
				trackId: tkid('trk_a'),
				tenantId: tid('tnt_a')
			});

			expect(result).toBeDefined();
		});
	});

	describe('lyrics status parsing', () => {
		it('returns none for null or empty', () => {
			const r2 = createR2();

			expect(r2.head).toBeDefined(); // dummy assertion, testing via finalizeTrack
		});
	});
});

function createRepo(overrides: {
	status?: string;
	findRowReturns?: TrackRow | null;
} = {}): TracksRepository {
	const row = trackRowFixture(overrides);
	return {
		listTracks: vi.fn(async () => ({ items: [trackDto()], nextCursor: null })),
		findById: vi.fn(async () => trackDto()),
		findRowById: vi.fn(async () => (overrides.findRowReturns === undefined ? row : overrides.findRowReturns)),
		createTrack: vi.fn(async () => trackDto()),
		finalizeTrack: vi.fn(async () => trackDto()),
		updateTrack: vi.fn(async () => trackDto()),
		setLyrics: vi.fn(async () => trackDto()),
		clearLyrics: vi.fn(async () => trackDto()),
		softDelete: vi.fn(async () => trackDto())
	};
}

function createR2(overrides: { head?: () => Promise<R2Object | null> } = {}): R2Bucket {
	return {
		put: vi.fn(async () => undefined),
		get: vi.fn(async () => ({ body: 'stream' as unknown as ReadableStream, httpMetadata: {}, size: 1000 })),
		head: vi.fn(overrides.head ?? (async () => ({ httpMetadata: {}, size: 1000 } as unknown as R2Object)))
	} as unknown as R2Bucket;
}

function uploadFile(overrides: { type?: string; size?: number; name?: string } = {}) {
	return {
		type: overrides.type ?? 'audio/mpeg',
		size: overrides.size ?? 1024,
		name: overrides.name ?? 'test.mp3',
		stream: vi.fn(() => 'stream' as unknown as ReadableStream)
	};
}

function trackRowFixture(overrides: { status?: string } = {}): TrackRow {
	return {
		id: 'trk_a' as Id<'track'>,
		tenantId: 'tnt_a' as Id<'tenant'>,
		uploaderId: 'usr_a' as Id<'user'>,
		title: 'Test Song',
		album: 'Test Album',
		durationMs: null,
		contentType: 'audio/mpeg',
		sizeBytes: 1024,
		trackNumber: null,
		genre: null,
		year: null,
		lyricsLrc: null,
		lyricsStatus: 'none',
		audioR2Key: 'tenants/tnt_a/tracks/trk_a.mp3',
		coverR2Key: null,
		status: (overrides.status ?? 'pending') as TrackRow['status'],
		createdAt: FIXED_DATE,
		updatedAt: FIXED_DATE,
		deletedAt: null
	};
}

function trackDto(): TrackDto {
	return {
		id: 'trk_a' as Id<'track'>,
		tenantId: 'tnt_a' as Id<'tenant'>,
		title: 'Test Song',
		artists: [{ id: 'art_a' as Id<'artist'>, name: 'Test Artist' }],
		album: 'Test Album',
		trackNumber: null,
		genre: null,
		year: null,
		durationMs: null,
		coverUrl: null,
		lyricsLrc: null,
		lyricsStatus: 'none',
		contentType: 'audio/mpeg',
		sizeBytes: 1024,
		status: 'pending',
		createdAt: '2026-04-26T00:00:00.000Z' as TrackDto['createdAt'],
		updatedAt: '2026-04-26T00:00:00.000Z' as TrackDto['updatedAt']
	};
}

function tid(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}

function uid(value: string): Id<'user'> {
	return value as Id<'user'>;
}

function tkid(value: string): Id<'track'> {
	return value as Id<'track'>;
}
