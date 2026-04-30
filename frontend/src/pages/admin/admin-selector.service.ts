import { api } from '$shared/api/client';
import {
	buildAdminTenantsPath,
	buildAdminUsersPath,
	type AdminListParams,
	type AdminUsersParams
} from '$shared/query/admin.query';
import type {
	AdminTenantListItemDto,
	AdminUserListItemDto,
	Id,
	ListResponse
} from '$shared/types/dto';
import type {
	EntityComboboxOption,
	EntityComboboxSearch,
	EntityComboboxSearchParams
} from './components/entity-combobox.type';

export function createTenantSelectorSearch(
	params: Omit<AdminListParams, 'q' | 'limit' | 'cursor'> = {}
): EntityComboboxSearch<Id<'tenant'>> {
	return async (searchParams) => {
		const response = await api<ListResponse<AdminTenantListItemDto>>(
			buildAdminTenantsPath({ ...params, ...searchParams })
		);
		return mapListResponse(response, tenantOption);
	};
}

export function createUserSelectorSearch(
	params: Omit<AdminUsersParams, 'q' | 'limit' | 'cursor'> = {}
): EntityComboboxSearch<Id<'user'>> {
	return async (searchParams) => {
		const response = await api<ListResponse<AdminUserListItemDto>>(
			buildAdminUsersPath({ includeInactive: false, ...params, ...searchParams })
		);
		return mapListResponse(response, userOption);
	};
}

function mapListResponse<TItem, TId extends Id<'tenant'> | Id<'user'>>(
	response: ListResponse<TItem>,
	mapper: (item: TItem) => EntityComboboxOption<TId>
): ListResponse<EntityComboboxOption<TId>> {
	return {
		items: response.items.map(mapper),
		nextCursor: response.nextCursor
	};
}

function tenantOption(tenant: AdminTenantListItemDto): EntityComboboxOption<Id<'tenant'>> {
	return { id: tenant.id, label: tenant.name, detail: tenant.id };
}

function userOption(user: AdminUserListItemDto): EntityComboboxOption<Id<'user'>> {
	return { id: user.id, label: user.username, detail: user.id };
}
