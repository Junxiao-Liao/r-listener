import type { Db } from '../db';

export type PrefsRepository = {
	readonly db: Db;
};

export function createPrefsRepository(db: Db): PrefsRepository {
	return { db };
}
