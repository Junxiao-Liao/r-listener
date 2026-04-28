import { createQuery } from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { queryKeys } from '$shared/query/keys';
import type { AdminTenantListItemDto } from '$shared/types/dto';

export function useAdminTenantsQuery(enabled: () => boolean) {
	return createQuery<{ tenants: AdminTenantListItemDto[] }, ApiError>({
		queryKey: queryKeys.adminTenants,
		queryFn: () => api<{ tenants: AdminTenantListItemDto[] }>('/admin/tenants'),
		get enabled() {
			return enabled();
		}
	});
}
