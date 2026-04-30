import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
import { api, type ApiError } from '$shared/api/client';
import { suppressGlobalApiErrorToast } from '$shared/feedback/error-toast.service';
import { queryKeys } from '$shared/query/keys';
import type {
	AdminCreateTenantInput,
	AdminCreateUserInput,
	AdminTenantListItemDto,
	AdminTenantMemberDto,
	AdminUpdateTenantInput,
	AdminUpdateUserInput,
	AdminUserDetailDto,
	AdminUserListItemDto,
	Id,
	ListResponse,
	TenantDto,
	TenantMembershipDto,
	TenantRole,
	UserDto
} from '$shared/types/dto';

export type AdminListParams = {
	q?: string;
	limit?: number;
	cursor?: string | null;
	excludeUserId?: Id<'user'>;
};

export type AdminUsersParams = AdminListParams & {
	includeInactive?: boolean;
	excludeTenantId?: Id<'tenant'>;
};

function listPath(base: string, params: Record<string, string | number | boolean | null | undefined>) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
	}
	const query = search.toString();
	return query ? `${base}?${query}` : base;
}

export function buildAdminTenantsPath(params: AdminListParams = {}) {
	return listPath('/admin/tenants', {
		limit: params.limit,
		cursor: params.cursor,
		q: params.q,
		excludeUserId: params.excludeUserId
	});
}

export function buildAdminUsersPath(params: AdminUsersParams = {}) {
	return listPath('/admin/users', {
		limit: params.limit,
		cursor: params.cursor,
		q: params.q,
		excludeUserId: params.excludeUserId,
		excludeTenantId: params.excludeTenantId,
		includeInactive: params.includeInactive ? 'true' : undefined
	});
}

export function useAdminTenantsQuery(enabled: () => boolean, params: () => AdminListParams = () => ({})) {
	return createQuery<ListResponse<AdminTenantListItemDto>, ApiError>({
		get queryKey() {
			return queryKeys.adminTenants(params());
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<ListResponse<AdminTenantListItemDto>>(buildAdminTenantsPath(params())),
		get enabled() {
			return enabled();
		}
	});
}

export function useAdminUsersQuery(params: () => AdminUsersParams = () => ({})) {
	return createQuery<ListResponse<AdminUserListItemDto>, ApiError>({
		get queryKey() {
			return queryKeys.adminUsers(params());
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<ListResponse<AdminUserListItemDto>>(buildAdminUsersPath(params()))
	});
}

export function useAdminUserQuery(id: () => Id<'user'> | null) {
	return createQuery<AdminUserDetailDto, ApiError>({
		get queryKey() {
			return queryKeys.adminUser(id() ?? '');
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<AdminUserDetailDto>(`/admin/users/${id()}`),
		get enabled() {
			return !!id();
		}
	});
}

export function useAdminTenantQuery(id: () => Id<'tenant'> | null) {
	return createQuery<TenantDto, ApiError>({
		get queryKey() {
			return queryKeys.adminTenant(id() ?? '');
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<TenantDto>(`/admin/tenants/${id()}`),
		get enabled() {
			return !!id();
		}
	});
}

export function useAdminTenantMembersQuery(id: () => Id<'tenant'> | null) {
	return createQuery<ListResponse<AdminTenantMemberDto>, ApiError>({
		get queryKey() {
			return queryKeys.adminTenantMembers(id() ?? '');
		},
		meta: suppressGlobalApiErrorToast,
		queryFn: () => api<ListResponse<AdminTenantMemberDto>>(`/admin/tenants/${id()}/members`),
		get enabled() {
			return !!id();
		}
	});
}

export function useCreateAdminUserMutation() {
	const qc = useQueryClient();
	return createMutation<UserDto, ApiError, AdminCreateUserInput>({
		mutationFn: (body) => api<UserDto>('/admin/users', { method: 'POST', body }),
		meta: suppressGlobalApiErrorToast,
		onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin'] })
	});
}

export function useUpdateAdminUserMutation() {
	const qc = useQueryClient();
	return createMutation<UserDto, ApiError, { userId: Id<'user'>; patch: AdminUpdateUserInput }>({
		mutationFn: ({ userId, patch }) =>
			api<UserDto>(`/admin/users/${userId}`, { method: 'PATCH', body: patch }),
		onSuccess: (_, { userId }) => {
			void qc.invalidateQueries({ queryKey: queryKeys.adminUser(userId) });
			void qc.invalidateQueries({ queryKey: ['admin'] });
		}
	});
}

export function useResetAdminUserPasswordMutation() {
	return createMutation<void, ApiError, { userId: Id<'user'>; newPassword: string }>({
		mutationFn: ({ userId, newPassword }) =>
			api<void>(`/admin/users/${userId}/reset-password`, {
				method: 'POST',
				body: { newPassword }
			})
	});
}

export function useDeleteAdminUserMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, { userId: Id<'user'> }>({
		mutationFn: ({ userId }) => api<void>(`/admin/users/${userId}`, { method: 'DELETE' }),
		onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin'] })
	});
}

export function useCreateAdminTenantMutation() {
	const qc = useQueryClient();
	return createMutation<
		{ tenant: TenantDto; ownership: TenantMembershipDto },
		ApiError,
		AdminCreateTenantInput
	>({
		mutationFn: (body) => api('/admin/tenants', { method: 'POST', body }),
		meta: suppressGlobalApiErrorToast,
		onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
	});
}

export function useUpdateAdminTenantMutation() {
	const qc = useQueryClient();
	return createMutation<TenantDto, ApiError, { tenantId: Id<'tenant'>; patch: AdminUpdateTenantInput }>({
		mutationFn: ({ tenantId, patch }) =>
			api<TenantDto>(`/admin/tenants/${tenantId}`, { method: 'PATCH', body: patch }),
		onSuccess: (_, { tenantId }) => {
			void qc.invalidateQueries({ queryKey: queryKeys.adminTenant(tenantId) });
			void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
		}
	});
}

export function useDeleteAdminTenantMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, { tenantId: Id<'tenant'> }>({
		mutationFn: ({ tenantId }) => api<void>(`/admin/tenants/${tenantId}`, { method: 'DELETE' }),
		onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin'] })
	});
}

export function useCreateAdminMembershipMutation() {
	const qc = useQueryClient();
	return createMutation<
		TenantMembershipDto,
		ApiError,
		{ tenantId: Id<'tenant'>; userId: Id<'user'>; role: TenantRole }
	>({
		mutationFn: ({ tenantId, userId, role }) =>
			api<TenantMembershipDto>(`/admin/tenants/${tenantId}/members`, {
				method: 'POST',
				body: { userId, role }
			}),
		meta: suppressGlobalApiErrorToast,
		onSuccess: (_, { tenantId, userId }) => {
			void qc.invalidateQueries({ queryKey: queryKeys.adminTenantMembers(tenantId) });
			void qc.invalidateQueries({ queryKey: queryKeys.adminUser(userId) });
			void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
			void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
		}
	});
}

export function useUpdateAdminMembershipMutation() {
	const qc = useQueryClient();
	return createMutation<
		TenantMembershipDto,
		ApiError,
		{ tenantId: Id<'tenant'>; userId: Id<'user'>; role: TenantRole }
	>({
		mutationFn: ({ tenantId, userId, role }) =>
			api<TenantMembershipDto>(`/admin/tenants/${tenantId}/members/${userId}`, {
				method: 'PATCH',
				body: { role }
			}),
		meta: suppressGlobalApiErrorToast,
		onSuccess: (_, { tenantId, userId }) => {
			void qc.invalidateQueries({ queryKey: queryKeys.adminTenantMembers(tenantId) });
			void qc.invalidateQueries({ queryKey: queryKeys.adminUser(userId) });
		}
	});
}

export function useDeleteAdminMembershipMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, { tenantId: Id<'tenant'>; userId: Id<'user'> }>({
		mutationFn: ({ tenantId, userId }) =>
			api<void>(`/admin/tenants/${tenantId}/members/${userId}`, { method: 'DELETE' }),
		meta: suppressGlobalApiErrorToast,
		onSuccess: (_, { tenantId, userId }) => {
			void qc.invalidateQueries({ queryKey: queryKeys.adminTenantMembers(tenantId) });
			void qc.invalidateQueries({ queryKey: queryKeys.adminUser(userId) });
			void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
			void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
		}
	});
}
