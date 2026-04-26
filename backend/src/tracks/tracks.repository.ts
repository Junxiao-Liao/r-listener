import type { Db } from '../db';

export type TracksRepository = {
	readonly db: Db;
};

export function createTracksRepository(db: Db): TracksRepository {
	return { db };
}
