import type { Db } from '../db';

export type QueueRepository = {
	readonly db: Db;
};

export function createQueueRepository(db: Db): QueueRepository {
	return { db };
}
