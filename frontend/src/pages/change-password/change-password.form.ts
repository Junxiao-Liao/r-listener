import { z } from 'zod';

// Backend rule (auth/password.ts): ≥12 chars and ≥3 of {lower, upper, digit, symbol}.
// Mirror it client-side for UX; backend remains authoritative.
export function isStrongPassword(password: string): boolean {
	if (password.length < 12) return false;
	const checks = [
		/[a-z]/.test(password),
		/[A-Z]/.test(password),
		/\d/.test(password),
		/[^A-Za-z0-9]/.test(password)
	];
	return checks.filter(Boolean).length >= 3;
}

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required.'),
		newPassword: z.string().min(1, 'New password is required.'),
		confirmPassword: z.string().min(1, 'Confirm your new password.')
	})
	.refine((d) => isStrongPassword(d.newPassword), {
		path: ['newPassword'],
		message: 'weak_password'
	})
	.refine((d) => d.newPassword === d.confirmPassword, {
		path: ['confirmPassword'],
		message: 'mismatch'
	});

export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export const defaultChangePasswordForm: ChangePasswordForm = {
	currentPassword: '',
	newPassword: '',
	confirmPassword: ''
};
