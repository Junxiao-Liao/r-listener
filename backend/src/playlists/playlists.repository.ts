import type { Db } from '../db';

export type PlaylistsRepository = {
	readonly db: Db;
};

export function createPlaylistsRepository(db: Db): PlaylistsRepository {
	return { db };
}
