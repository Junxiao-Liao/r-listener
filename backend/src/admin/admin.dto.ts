import { z } from 'zod';
import { tenantRoleSchema } from '../tenants/tenants.dto';
import { usernameSchema } from '../users/users.dto';

export const adminListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(200).default(50),
	cursor: z.string().optional(),
	q: z.string().optional()
});

export const adminUserListQuerySchema = adminListQuerySchema.extend({
	includeInactive: z
		.union([z.literal('true'), z.literal('false'), z.boolean()])
		.optional()
		.transform((value) => value === true || value === 'true')
});

export const adminCreateUserSchema = z.object({
	username: usernameSchema,
	password: z.string().min(1),
	isAdmin: z.boolean().default(false),
	initialMembership: z
		.object({
			tenantId: z.string(),
			role: tenantRoleSchema
		})
		.optional()
});

export const adminUpdateUserSchema = z
	.object({
		username: usernameSchema.optional(),
		isAdmin: z.boolean().optional(),
		isActive: z.boolean().optional()
	})
	.refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const adminResetPasswordSchema = z.object({
	newPassword: z.string().min(1)
});

export const adminCreateTenantSchema = z.object({
	name: z.string().trim().min(1).max(120),
	ownerUserId: z.string()
});

export const adminUpdateTenantSchema = z.object({
	name: z.string().trim().min(1).max(120)
});

export const adminCreateMembershipSchema = z.object({
	userId: z.string(),
	role: tenantRoleSchema
});

export const adminUpdateMembershipSchema = z.object({
	role: tenantRoleSchema
});
