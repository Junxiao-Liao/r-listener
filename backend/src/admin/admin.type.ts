import type { TenantDto, TenantMembershipDto } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';
import type { Id } from '../shared/shared.type';

export type AdminUserListItemDto = UserDto & {
	workspaceCount: number;
};

export type AdminUserDetailDto = UserDto & {
	memberships: TenantMembershipDto[];
};

export type AdminTenantListItemDto = TenantDto & {
	memberCount: number;
	trackCount: number;
};

export type AdminTenantMemberDto = TenantMembershipDto & {
	user: UserDto;
};

export type AdminListResponse<T> = {
	items: T[];
	nextCursor: string | null;
};

export type AdminListQuery = {
	limit: number;
	cursor?: string | undefined;
	q?: string | undefined;
};

export type AdminUserListQuery = AdminListQuery & {
	includeInactive: boolean;
};

export type AdminCreateUserInput = {
	username: string;
	password: string;
	isAdmin: boolean;
	initialMembership?: {
		tenantId: Id<'tenant'>;
		role: TenantMembershipDto['role'];
	};
};

export type AdminUpdateUserInput = {
	username?: string | undefined;
	isAdmin?: boolean | undefined;
	isActive?: boolean | undefined;
};

export type AdminResetPasswordInput = {
	newPassword: string;
};

export type AdminCreateTenantInput = {
	name: string;
	ownerUserId: Id<'user'>;
};

export type AdminUpdateTenantInput = {
	name: string;
};

export type AdminCreateMembershipInput = {
	userId: Id<'user'>;
	role: TenantMembershipDto['role'];
};

export type AdminUpdateMembershipInput = {
	role: TenantMembershipDto['role'];
};
