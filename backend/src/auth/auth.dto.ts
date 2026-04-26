import { z } from 'zod';

export const signinInputSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1)
});

export const switchTenantInputSchema = z.object({
	tenantId: z.string().min(1)
});

export const changePasswordInputSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8)
});
