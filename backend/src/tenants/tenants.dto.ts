import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { TenantDto, TenantMembershipDto } from './tenants.type';
import type { memberships, tenants } from './tenants.orm';

export const tenantRoleSchema = z.enum(['owner', 'member', 'viewer']);

export const tenantDtoSchema = z.object({
	id: z.string(),
	name: z.string(),
	createdAt: z.string()
});

export const tenantMembershipDtoSchema = z.object({
	tenantId: z.string(),
	tenantName: z.string(),
	role: tenantRoleSchema,
	createdAt: z.string()
});

export function toTenantDto(tenant: typeof tenants.$inferSelect): TenantDto {
	return {
		id: tenant.id as TenantDto['id'],
		name: tenant.name,
		createdAt: fromUnixTimestampSeconds(tenant.createdAt)
	};
}

export function toTenantMembershipDto(
	membership: typeof memberships.$inferSelect,
	tenant: typeof tenants.$inferSelect
): TenantMembershipDto {
	return {
		tenantId: tenant.id as TenantMembershipDto['tenantId'],
		tenantName: tenant.name,
		role: membership.role,
		createdAt: fromUnixTimestampSeconds(membership.createdAt)
	};
}
