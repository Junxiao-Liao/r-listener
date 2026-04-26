import type { Db } from '../db';

export type TenantsRepository = {
	readonly db: Db;
};

export function createTenantsRepository(db: Db): TenantsRepository {
	return { db };
}
