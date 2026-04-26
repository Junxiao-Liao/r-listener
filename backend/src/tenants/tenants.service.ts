import type { TenantsRepository } from './tenants.repository';

export type TenantsService = {
	readonly tenantsRepository: TenantsRepository;
};

export function createTenantsService(tenantsRepository: TenantsRepository): TenantsService {
	return { tenantsRepository };
}
