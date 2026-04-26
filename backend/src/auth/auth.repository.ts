import type { Db } from '../db';

export type AuthRepository = {
	readonly db: Db;
};

export function createAuthRepository(db: Db): AuthRepository {
	return { db };
}
