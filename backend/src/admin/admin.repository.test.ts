import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { createAdminRepository } from './admin.repository';

function mockKv(): KVNamespace {
	return {
		get: vi.fn(async () => null),
		put: vi.fn(async () => {}),
		delete: vi.fn(async () => {}),
		list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' }))
	} as unknown as KVNamespace;
}

describe('admin repository list exclusions', () => {
	it('adds an active membership exclusion subquery when listing users', async () => {
		const db = createListDb();
		const repository = createAdminRepository(db as unknown as Db, mockKv());

		await repository.listUsers({
			limit: 10,
			cursor: undefined,
			q: undefined,
			includeInactive: false,
			excludeTenantId: 'tnt_a' as Id<'tenant'>
		});

		expect(db.select).toHaveBeenCalledTimes(2);
		expect(db.queries[0]?.where).toHaveBeenCalled();
		expect(db.queries[1]?.offset).toHaveBeenCalledWith(0);
	});

	it('adds an active membership exclusion subquery when listing tenants', async () => {
		const db = createListDb();
		const repository = createAdminRepository(db as unknown as Db, mockKv());

		await repository.listTenants({
			limit: 10,
			cursor: undefined,
			q: undefined,
			excludeUserId: 'usr_a' as Id<'user'>
		});

		expect(db.select).toHaveBeenCalledTimes(2);
		expect(db.queries[0]?.where).toHaveBeenCalled();
		expect(db.queries[1]?.offset).toHaveBeenCalledWith(0);
	});
});

function createListDb() {
	const queries: Array<ReturnType<typeof createSelectQuery>> = [];
	const db = {
		queries,
		select: vi.fn(() => {
			const query = createSelectQuery();
			queries.push(query);
			return query;
		})
	};
	return db;
}

function createSelectQuery() {
	const query = {
		from: vi.fn(() => query),
		where: vi.fn(() => query),
		orderBy: vi.fn(() => query),
		limit: vi.fn(() => query),
		offset: vi.fn(async () => [])
	};
	return query;
}
