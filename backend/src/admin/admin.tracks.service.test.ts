import { describe, expect, it, vi } from 'vitest';
import type { Id } from '../shared/shared.type';
import { createAdminTracksService } from './admin.tracks.service';
import type { AdminTracksRepository } from './admin.tracks.repository';
import type { AdminTrackDeleteCandidate } from './admin.tracks.type';

const FIXED_NOW = new Date('2026-05-02T10:00:00.000Z');

describe('admin tracks service', () => {
	it('hard-deletes tracks and R2 keys when no live references remain', async () => {
		const repository = repositoryFixture({
			tracksForDelete: [trackDeleteCandidate({ id: trackId('trk_a'), audioR2Key: 'audio/a.mp3', sizeBytes: 123 })],
			referencedKeys: [],
			deletedCount: 1
		});
		const r2 = r2Fixture();
		const service = createAdminTracksService({ adminTracksRepository: repository, r2, now: () => FIXED_NOW });

		const result = await service.hardDeleteTracks({
			actor: actor(),
			input: { trackIds: [trackId('trk_a')] }
		});

		expect(repository.hardDeleteTracks).toHaveBeenCalledWith([trackId('trk_a')]);
		expect(r2.delete).toHaveBeenCalledWith(['audio/a.mp3']);
		expect(repository.insertTrackHardDeleteAuditLogs).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: userId('usr_admin'),
				now: FIXED_NOW,
				entries: [
					expect.objectContaining({
						trackId: trackId('trk_a'),
						r2Deleted: true
					})
				]
			})
		);
		expect(result).toEqual({
			deletedCount: 1,
			freedBytes: 123,
			r2KeysDeleted: 1,
			r2KeysRetained: 0
		});
	});

	it('retains shared R2 keys when another live track still references them', async () => {
		const repository = repositoryFixture({
			tracksForDelete: [trackDeleteCandidate({ id: trackId('trk_a'), audioR2Key: 'audio/shared.mp3', sizeBytes: 200 })],
			referencedKeys: ['audio/shared.mp3'],
			deletedCount: 1
		});
		const r2 = r2Fixture();
		const service = createAdminTracksService({ adminTracksRepository: repository, r2, now: () => FIXED_NOW });

		const result = await service.hardDeleteTracks({
			actor: actor(),
			input: { trackIds: [trackId('trk_a')] }
		});

		expect(r2.delete).not.toHaveBeenCalled();
		expect(result).toEqual({
			deletedCount: 1,
			freedBytes: 0,
			r2KeysDeleted: 0,
			r2KeysRetained: 1
		});
	});

	it('deduplicates R2 key deletion and freed bytes across duplicate rows', async () => {
		const repository = repositoryFixture({
			tracksForDelete: [
				trackDeleteCandidate({ id: trackId('trk_a'), audioR2Key: 'audio/shared.mp3', sizeBytes: 512 }),
				trackDeleteCandidate({ id: trackId('trk_b'), audioR2Key: 'audio/shared.mp3', sizeBytes: 512 })
			],
			referencedKeys: [],
			deletedCount: 2
		});
		const r2 = r2Fixture();
		const service = createAdminTracksService({ adminTracksRepository: repository, r2, now: () => FIXED_NOW });

		const result = await service.hardDeleteTracks({
			actor: actor(),
			input: { trackIds: [trackId('trk_a'), trackId('trk_b')] }
		});

		expect(r2.delete).toHaveBeenCalledWith(['audio/shared.mp3']);
		expect(result.freedBytes).toBe(512);
		expect(result.r2KeysDeleted).toBe(1);
	});

	it('returns 404 when none of the requested track IDs exist', async () => {
		const repository = repositoryFixture({ tracksForDelete: [], referencedKeys: [], deletedCount: 0 });
		const r2 = r2Fixture();
		const service = createAdminTracksService({ adminTracksRepository: repository, r2, now: () => FIXED_NOW });

		await expect(
			service.hardDeleteTracks({
				actor: actor(),
				input: { trackIds: [trackId('trk_missing')] }
			})
		).rejects.toMatchObject({ status: 404, code: 'track_not_found' });
	});

	it('writes one audit row per deleted track with per-row r2Deleted flag', async () => {
		const repository = repositoryFixture({
			tracksForDelete: [
				trackDeleteCandidate({
					id: trackId('trk_a'),
					tenantId: tenantId('tnt_a'),
					audioR2Key: 'audio/a.mp3',
					sizeBytes: 100
				}),
				trackDeleteCandidate({
					id: trackId('trk_b'),
					tenantId: tenantId('tnt_b'),
					audioR2Key: 'audio/b.mp3',
					sizeBytes: 200
				})
			],
			referencedKeys: ['audio/b.mp3'],
			deletedCount: 2
		});
		const r2 = r2Fixture();
		const service = createAdminTracksService({ adminTracksRepository: repository, r2, now: () => FIXED_NOW });

		await service.hardDeleteTracks({
			actor: actor(),
			input: { trackIds: [trackId('trk_a'), trackId('trk_b')] }
		});

		const calls = (repository.insertTrackHardDeleteAuditLogs as unknown as ReturnType<typeof vi.fn>).mock
			.calls;
		expect(calls).toHaveLength(1);
		expect(calls[0]![0].entries).toEqual([
			expect.objectContaining({ trackId: trackId('trk_a'), r2Deleted: true }),
			expect.objectContaining({ trackId: trackId('trk_b'), r2Deleted: false })
		]);
	});
});

type RepositoryFixtureOptions = {
	tracksForDelete: AdminTrackDeleteCandidate[];
	referencedKeys: string[];
	deletedCount: number;
};

function repositoryFixture(options: RepositoryFixtureOptions): AdminTracksRepository {
	return {
		listTracks: vi.fn(async () => ({ items: [], nextCursor: null })),
		findTracksForDelete: vi.fn(async () => options.tracksForDelete),
		findReferencedR2Keys: vi.fn(async () => options.referencedKeys),
		hardDeleteTracks: vi.fn(async () => options.deletedCount),
		insertTrackHardDeleteAuditLogs: vi.fn(async () => undefined)
	};
}

function r2Fixture(): R2Bucket {
	return {
		delete: vi.fn(async () => undefined)
	} as unknown as R2Bucket;
}

function trackDeleteCandidate(
	overrides: Partial<AdminTrackDeleteCandidate> = {}
): AdminTrackDeleteCandidate {
	return {
		id: trackId('trk_default'),
		tenantId: tenantId('tnt_a'),
		audioR2Key: 'audio/default.mp3',
		sizeBytes: 100,
		...overrides
	};
}

function actor() {
	return { id: userId('usr_admin') };
}

function userId(value: string): Id<'user'> {
	return value as Id<'user'>;
}

function trackId(value: string): Id<'track'> {
	return value as Id<'track'>;
}

function tenantId(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}

