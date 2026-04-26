import type { Db } from '../db';

export type SearchRepository = {
	readonly db: Db;
};

export function createSearchRepository(db: Db): SearchRepository {
	return { db };
}
