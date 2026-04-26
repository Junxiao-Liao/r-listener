import type { TenantDto, TenantMembershipDto } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';

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
