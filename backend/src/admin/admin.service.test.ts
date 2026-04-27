import { describe, expect, it, vi } from 'vitest';
import { createAdminService } from './admin.service';
import type { AdminRepository } from './admin.repository';
import type { AdminTenantListItemDto } from './admin.type';

describe('admin service', () => {
	it('lists active tenants from the repository', async () => {
		const tenants = [tenantFixture({ memberCount: 2, trackCount: 8 })];
		const repository: AdminRepository = {
			db: {} as never,
			listActiveTenants: vi.fn(async () => tenants)
		};
		const service = createAdminService(repository);

		await expect(service.listTenants()).resolves.toEqual(tenants);
		expect(repository.listActiveTenants).toHaveBeenCalledOnce();
	});
});

function tenantFixture(overrides: Partial<AdminTenantListItemDto> = {}): AdminTenantListItemDto {
	return {
		id: 'tnt_a' as AdminTenantListItemDto['id'],
		name: 'Tenant A',
		createdAt: '2026-04-01T00:00:00.000Z' as AdminTenantListItemDto['createdAt'],
		memberCount: 0,
		trackCount: 0,
		...overrides
	};
}
