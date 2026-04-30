import { isStrongPassword } from '$pages/change-password/change-password.form';

export type AdminResetPasswordValidation =
	| { ok: true }
	| { ok: false; error: 'weak_password' };

export function validateAdminResetPassword(password: string): AdminResetPasswordValidation {
	if (!isStrongPassword(password)) return { ok: false, error: 'weak_password' };
	return { ok: true };
}
