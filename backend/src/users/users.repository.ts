import type { Db } from '../db';

export type UsersRepository = {
	readonly db: Db;
};

export function createUsersRepository(db: Db): UsersRepository {
	return { db };
}
