import type { ApiClient } from '$shared/server/api';
import type { AdminTenantListItemDto } from '$shared/types/dto';

export const adminApi = {
	listTenants(api: ApiClient) {
		return api.request<{ tenants: AdminTenantListItemDto[] }>('/admin/tenants');
	}
};
