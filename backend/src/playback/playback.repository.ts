import type { Db } from '../db';

export type PlaybackRepository = {
	readonly db: Db;
};

export function createPlaybackRepository(db: Db): PlaybackRepository {
	return { db };
}
