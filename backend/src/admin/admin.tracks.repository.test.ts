import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { createAdminTracksRepository } from './admin.tracks.repository';

describe('admin tracks repository', () => {
	it('uses offset cursor pagination for track listing', async () => {
		const db = createListDb([]);
		const repository = createAdminTracksRepository(db as unknown as Db);

		await repository.listTracks({
			limit: 10,
			cursor: btoa(JSON.stringify({ offset: 20 })),
			q: undefined,
			tenantId: undefined
		});

		expect(db.select).toHaveBeenCalledTimes(1);
		expect(db.query.offset).toHaveBeenCalledWith(20);
	});

	it('returns empty references without querying when no R2 keys provided', async () => {
		const db = createReferenceDb([]);
		const repository = createAdminTracksRepository(db as unknown as Db);

		const result = await repository.findReferencedR2Keys([], [trackId('trk_a')]);

		expect(result).toEqual([]);
		expect(db.select).not.toHaveBeenCalled();
	});

	it('returns unique referenced keys outside the delete set', async () => {
		const db = createReferenceDb([
			{ id: 'trk_keep_a', audioR2Key: 'audio/shared.mp3' },
			{ id: 'trk_keep_b', audioR2Key: 'audio/shared.mp3' },
			{ id: 'trk_delete', audioR2Key: 'audio/shared.mp3' },
			{ id: 'trk_keep_c', audioR2Key: 'audio/other.mp3' }
		]);
		const repository = createAdminTracksRepository(db as unknown as Db);

		const result = await repository.findReferencedR2Keys(
			['audio/shared.mp3', 'audio/other.mp3'],
			[trackId('trk_delete')]
		);

		expect(result).toEqual(['audio/shared.mp3', 'audio/other.mp3']);
		expect(db.select).toHaveBeenCalledTimes(1);
	});
});

function createListDb(rows: unknown[]) {
	const query = {
		from: vi.fn(() => query),
		leftJoin: vi.fn(() => query),
		where: vi.fn(() => query),
		orderBy: vi.fn(() => query),
		limit: vi.fn(() => query),
		offset: vi.fn(async () => rows)
	};

	return {
		query,
		select: vi.fn(() => query)
	};
}

function createReferenceDb(rows: Array<{ id: string; audioR2Key: string }>) {
	const inner = {
		where: vi.fn(async () => rows)
	};
	const query = {
		from: vi.fn(() => inner)
	};
	return {
		select: vi.fn(() => query)
	};
}

function trackId(value: string): Id<'track'> {
	return value as Id<'track'>;
}

