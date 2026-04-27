import { asc, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { memberships, tenants } from '../tenants/tenants.orm';
import { toTenantDto } from '../tenants/tenants.dto';
import { tracks } from '../tracks/tracks.orm';
import type { AdminTenantListItemDto } from './admin.type';

export type AdminRepository = {
	readonly db: Db;
	listActiveTenants(): Promise<AdminTenantListItemDto[]>;
};

export function createAdminRepository(db: Db): AdminRepository {
	return {
		db,
		listActiveTenants: async () => {
			const tenantRows = await db
				.select()
				.from(tenants)
				.where(isNull(tenants.deletedAt))
				.orderBy(asc(tenants.name));

			const membershipCountRows = await db
				.select({
					tenantId: memberships.tenantId,
					count: sql<number>`count(*)`
				})
				.from(memberships)
				.where(isNull(memberships.deletedAt))
				.groupBy(memberships.tenantId);

			const trackCountRows = await db
				.select({
					tenantId: tracks.tenantId,
					count: sql<number>`count(*)`
				})
				.from(tracks)
				.where(isNull(tracks.deletedAt))
				.groupBy(tracks.tenantId);

			const memberCounts = countMap(membershipCountRows);
			const trackCounts = countMap(trackCountRows);

			return tenantRows.map((tenant) => ({
				...toTenantDto(tenant),
				memberCount: memberCounts.get(tenant.id) ?? 0,
				trackCount: trackCounts.get(tenant.id) ?? 0
			}));
		}
	};
}

function countMap(rows: { tenantId: string; count: number }[]): Map<string, number> {
	return new Map(rows.map((row) => [row.tenantId, Number(row.count)]));
}
