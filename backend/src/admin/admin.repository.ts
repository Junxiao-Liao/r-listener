import type { Db } from '../db';

export type AdminRepository = {
	readonly db: Db;
};

export function createAdminRepository(db: Db): AdminRepository {
	return { db };
}
