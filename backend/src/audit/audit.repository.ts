import type { Db } from '../db';

export type AuditRepository = {
	readonly db: Db;
};

export function createAuditRepository(db: Db): AuditRepository {
	return { db };
}
