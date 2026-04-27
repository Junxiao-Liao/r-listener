import type { Db } from '../db';
import { createAdminRepository, type AdminRepository } from './admin.repository';
import type { AdminTenantListItemDto } from './admin.type';

export type AdminService = {
	readonly adminRepository: AdminRepository;
	listTenants(): Promise<AdminTenantListItemDto[]>;
};

export function createAdminService(adminRepository: AdminRepository): AdminService {
	return {
		adminRepository,
		listTenants: () => adminRepository.listActiveTenants()
	};
}

export function createAdminServiceForDb(db: Db): AdminService {
	return createAdminService(createAdminRepository(db));
}
