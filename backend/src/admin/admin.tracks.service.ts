import type { Db } from '../db';
import { apiError } from '../http/api-error';
import type { Id } from '../shared/shared.type';
import { createAdminTracksRepository, type AdminTracksRepository } from './admin.tracks.repository';
import type {
	AdminHardDeleteTracksInput,
	AdminHardDeleteTracksResult,
	AdminTrackListQuery
} from './admin.tracks.type';

export type AdminTracksActor = {
	id: Id<'user'>;
};

export type AdminTracksService = {
	readonly adminTracksRepository: AdminTracksRepository;
	listTracks(query: AdminTrackListQuery): Promise<Awaited<ReturnType<AdminTracksRepository['listTracks']>>>;
	hardDeleteTracks(input: {
		actor: AdminTracksActor;
		input: AdminHardDeleteTracksInput;
	}): Promise<AdminHardDeleteTracksResult>;
};

export type AdminTracksServiceDependencies = {
	adminTracksRepository: AdminTracksRepository;
	r2: R2Bucket;
	now?: () => Date;
};

export function createAdminTracksService(deps: AdminTracksServiceDependencies): AdminTracksService {
	const now = deps.now ?? (() => new Date());

	return {
		adminTracksRepository: deps.adminTracksRepository,
		listTracks: (query) => deps.adminTracksRepository.listTracks(query),
		hardDeleteTracks: async ({ actor, input }) => {
			const tracksToDelete = await deps.adminTracksRepository.findTracksForDelete(input.trackIds);
			if (tracksToDelete.length === 0) {
				throw apiError(404, 'track_not_found', 'Track not found.');
			}

			const targetTrackIds = tracksToDelete.map((track) => track.id);
			const keySizeMap = new Map<string, number>();
			for (const row of tracksToDelete) {
				if (!keySizeMap.has(row.audioR2Key)) {
					keySizeMap.set(row.audioR2Key, row.sizeBytes);
				}
			}

			const uniqueKeys = [...keySizeMap.keys()];
			const referencedKeySet = new Set(
				await deps.adminTracksRepository.findReferencedR2Keys(uniqueKeys, targetTrackIds)
			);
			const keysToDelete = uniqueKeys.filter((key) => !referencedKeySet.has(key));
			const deletedKeySet = new Set(keysToDelete);

			const deletedCount = await deps.adminTracksRepository.hardDeleteTracks(targetTrackIds);
			if (keysToDelete.length > 0) {
				await deps.r2.delete(keysToDelete);
			}

			const timestamp = now();
			await deps.adminTracksRepository.insertTrackHardDeleteAuditLogs({
				actorId: actor.id,
				now: timestamp,
				entries: tracksToDelete.map((track) => ({
					trackId: track.id,
					tenantId: track.tenantId,
					audioR2Key: track.audioR2Key,
					sizeBytes: track.sizeBytes,
					r2Deleted: deletedKeySet.has(track.audioR2Key)
				}))
			});

			const freedBytes = keysToDelete.reduce((sum, key) => sum + (keySizeMap.get(key) ?? 0), 0);
			return {
				deletedCount,
				freedBytes,
				r2KeysDeleted: keysToDelete.length,
				r2KeysRetained: referencedKeySet.size
			};
		}
	};
}

export function createAdminTracksServiceForDb(db: Db, r2: R2Bucket): AdminTracksService {
	return createAdminTracksService({ adminTracksRepository: createAdminTracksRepository(db), r2 });
}

