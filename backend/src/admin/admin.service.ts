import type { AdminRepository } from './admin.repository';

export type AdminService = {
	readonly adminRepository: AdminRepository;
};

export function createAdminService(adminRepository: AdminRepository): AdminService {
	return { adminRepository };
}
