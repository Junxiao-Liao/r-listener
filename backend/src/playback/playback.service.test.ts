import { describe, expect, it } from 'vitest';
import type { Id, Iso8601 } from '../shared/shared.type';
import { createPlaybackService } from './playback.service';
import type {
	ListContinueListeningInput,
	ListRecentInput,
	PlaybackRepository,
	UpsertHistoryInput
} from './playback.repository';
import type { PlaybackEventInput } from './playback.type';

const FIXED_NOW = new Date('2026-04-29T12:00:00.000Z');

describe('playback service', () => {
	describe('recordEvents', () => {
		it('upserts one row per track using the latest startedAt', async () => {
			const repo = createFakeRepo({ visibleTracks: ['trk_a', 'trk_b'] });
			const service = createPlaybackService({ playbackRepository: repo, now: () => FIXED_NOW });

			await service.recordEvents({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				events: [
					event('trk_a', '2026-04-29T11:00:00.000Z', 0, 'play'),
					event('trk_a', '2026-04-29T11:01:00.000Z', 60000, 'progress'),
					event('trk_b', '2026-04-29T11:02:00.000Z', 0, 'play')
				]
			});

			expect(repo.upserts).toHaveLength(2);
			const aUpsert = repo.upserts.find((u) => u.trackId === 'trk_a')!;
			expect(aUpsert.lastPositionMs).toBe(60000);
			expect(aUpsert.lastPlayedAt.toISOString()).toBe('2026-04-29T11:01:00.000Z');
			const bUpsert = repo.upserts.find((u) => u.trackId === 'trk_b')!;
			expect(bUpsert.lastPositionMs).toBe(0);
		});

		it('clears lastPositionMs to 0 when latest event is "ended"', async () => {
			const repo = createFakeRepo({ visibleTracks: ['trk_a'] });
			const service = createPlaybackService({ playbackRepository: repo, now: () => FIXED_NOW });

			await service.recordEvents({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				events: [
					event('trk_a', '2026-04-29T11:00:00.000Z', 0, 'play'),
					event('trk_a', '2026-04-29T11:03:00.000Z', 180000, 'progress'),
					event('trk_a', '2026-04-29T11:03:30.000Z', 210000, 'ended')
				]
			});

			expect(repo.upserts).toHaveLength(1);
			expect(repo.upserts[0]!.lastPositionMs).toBe(0);
			expect(repo.upserts[0]!.lastPlayedAt.toISOString()).toBe('2026-04-29T11:03:30.000Z');
		});

		it('uses progress positionMs when ended is older than the latest progress', async () => {
			const repo = createFakeRepo({ visibleTracks: ['trk_a'] });
			const service = createPlaybackService({ playbackRepository: repo, now: () => FIXED_NOW });

			await service.recordEvents({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				events: [
					event('trk_a', '2026-04-29T11:00:00.000Z', 0, 'ended'),
					event('trk_a', '2026-04-29T11:05:00.000Z', 30000, 'progress')
				]
			});

			expect(repo.upserts[0]!.lastPositionMs).toBe(30000);
		});

		it('silently drops events for tracks not visible to the caller', async () => {
			const repo = createFakeRepo({ visibleTracks: ['trk_a'] });
			const service = createPlaybackService({ playbackRepository: repo, now: () => FIXED_NOW });

			await service.recordEvents({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				events: [
					event('trk_a', '2026-04-29T11:00:00.000Z', 0, 'play'),
					event('trk_other_tenant', '2026-04-29T11:00:00.000Z', 0, 'play'),
					event('trk_pending', '2026-04-29T11:00:00.000Z', 0, 'play')
				]
			});

			expect(repo.upserts).toHaveLength(1);
			expect(repo.upserts[0]!.trackId).toBe('trk_a');
		});

		it('does nothing when events array is empty', async () => {
			const repo = createFakeRepo({ visibleTracks: [] });
			const service = createPlaybackService({ playbackRepository: repo, now: () => FIXED_NOW });

			await service.recordEvents({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				events: []
			});

			expect(repo.upserts).toHaveLength(0);
		});

		it('passes playlistId through from the latest event', async () => {
			const repo = createFakeRepo({ visibleTracks: ['trk_a'] });
			const service = createPlaybackService({ playbackRepository: repo, now: () => FIXED_NOW });

			await service.recordEvents({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				events: [
					event('trk_a', '2026-04-29T11:00:00.000Z', 0, 'play', 'pl_x'),
					event('trk_a', '2026-04-29T11:01:00.000Z', 30000, 'progress', 'pl_y')
				]
			});

			expect(repo.upserts[0]!.playlistId).toBe('pl_y');
		});
	});

	describe('listRecent', () => {
		it('passes through to repository with cursor and limit', async () => {
			const repo = createFakeRepo({ visibleTracks: [] });
			const service = createPlaybackService({ playbackRepository: repo, now: () => FIXED_NOW });

			await service.listRecent({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				limit: 25,
				cursor: 'CURSOR'
			});

			expect(repo.listRecentCalls).toHaveLength(1);
			expect(repo.listRecentCalls[0]!.limit).toBe(25);
			expect(repo.listRecentCalls[0]!.cursor).toBe('CURSOR');
		});
	});

	describe('listContinueListening', () => {
		it('passes through to repository', async () => {
			const repo = createFakeRepo({ visibleTracks: [] });
			const service = createPlaybackService({ playbackRepository: repo, now: () => FIXED_NOW });

			await service.listContinueListening({
				userId: uid('usr_a'),
				tenantId: tid('tnt_a'),
				limit: 10
			});

			expect(repo.listContinueListeningCalls).toHaveLength(1);
			expect(repo.listContinueListeningCalls[0]!.limit).toBe(10);
		});
	});
});

type FakeRepo = PlaybackRepository & {
	upserts: UpsertHistoryInput[];
	listRecentCalls: ListRecentInput[];
	listContinueListeningCalls: ListContinueListeningInput[];
};

function createFakeRepo(options: { visibleTracks: string[] }): FakeRepo {
	const upserts: UpsertHistoryInput[] = [];
	const listRecentCalls: ListRecentInput[] = [];
	const listContinueListeningCalls: ListContinueListeningInput[] = [];
	const visible = new Set(options.visibleTracks);

	const repo: FakeRepo = {
		upserts,
		listRecentCalls,
		listContinueListeningCalls,
		filterVisibleTrackIds: async (trackIds) => {
			return new Set(trackIds.filter((id) => visible.has(id)));
		},
		upsertHistory: async (input) => {
			upserts.push(input);
		},
		listRecent: async (input) => {
			listRecentCalls.push(input);
			return { items: [], nextCursor: null };
		},
		listContinueListening: async (input) => {
			listContinueListeningCalls.push(input);
			return { items: [], nextCursor: null };
		}
	};

	return repo;
}

function event(
	trackId: string,
	startedAt: string,
	positionMs: number,
	kind: 'play' | 'progress' | 'ended',
	playlistId: string | null = null
): PlaybackEventInput {
	return {
		trackId: trackId as Id<'track'>,
		startedAt: startedAt as Iso8601,
		positionMs,
		event: kind,
		playlistId: playlistId as Id<'playlist'> | null
	};
}

function uid(value: string): Id<'user'> {
	return value as Id<'user'>;
}

function tid(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}
