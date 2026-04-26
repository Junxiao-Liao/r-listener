import { z } from 'zod';
import { usernameSchema } from '../users/users.dto';

export const signinInputSchema = z.object({
	username: usernameSchema,
	password: z.string().min(1)
});

export const switchTenantInputSchema = z.object({
	tenantId: z.string().min(1)
});

export const changePasswordInputSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(1)
});
