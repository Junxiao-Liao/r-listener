import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import {
	createPlaybackRepository,
	type ListContinueListeningInput,
	type ListRecentInput,
	type PlaybackRepository
} from './playback.repository';
import type { PlaybackEventInput, RecentTracksPage } from './playback.type';

export type RecordEventsInput = {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
	events: PlaybackEventInput[];
	now?: Date;
};

export type ListRecentServiceInput = Omit<ListRecentInput, 'userId' | 'tenantId'> & {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
};

export type ListContinueListeningServiceInput = Omit<
	ListContinueListeningInput,
	'userId' | 'tenantId'
> & {
	userId: Id<'user'>;
	tenantId: Id<'tenant'>;
};

export type PlaybackService = {
	recordEvents(input: RecordEventsInput): Promise<void>;
	listRecent(input: ListRecentServiceInput): Promise<RecentTracksPage>;
	listContinueListening(input: ListContinueListeningServiceInput): Promise<RecentTracksPage>;
};

export type PlaybackServiceDependencies = {
	playbackRepository: PlaybackRepository;
	now?: () => Date;
};

export function createPlaybackService(deps: PlaybackServiceDependencies): PlaybackService {
	const now = deps.now ?? (() => new Date());

	return {
		recordEvents: async (input) => {
			if (input.events.length === 0) return;

			const trackIds = Array.from(new Set(input.events.map((e) => e.trackId)));
			const visible = await deps.playbackRepository.filterVisibleTrackIds(
				trackIds,
				input.tenantId
			);

			const stamp = input.now ?? now();
			const visibleEvents = input.events.filter((e) => visible.has(e.trackId));

			const latestByTrack = new Map<Id<'track'>, PlaybackEventInput>();
			for (const event of visibleEvents) {
				const current = latestByTrack.get(event.trackId);
				if (!current || new Date(event.startedAt).getTime() > new Date(current.startedAt).getTime()) {
					latestByTrack.set(event.trackId, event);
				}
			}

			for (const event of latestByTrack.values()) {
				const positionMs = event.event === 'ended' ? 0 : event.positionMs;
				await deps.playbackRepository.upsertHistory({
					userId: input.userId,
					tenantId: input.tenantId,
					trackId: event.trackId,
					lastPlayedAt: new Date(event.startedAt),
					lastPositionMs: positionMs,
					playlistId: event.playlistId,
					now: stamp
				});
			}
		},

		listRecent: (input) =>
			deps.playbackRepository.listRecent({
				userId: input.userId,
				tenantId: input.tenantId,
				limit: input.limit,
				cursor: input.cursor
			}),

		listContinueListening: (input) =>
			deps.playbackRepository.listContinueListening({
				userId: input.userId,
				tenantId: input.tenantId,
				limit: input.limit
			})
	};
}

export function createPlaybackServiceForDb(db: Db, kv?: KVNamespace): PlaybackService {
	return createPlaybackService({ playbackRepository: createPlaybackRepository(db, kv) });
}
