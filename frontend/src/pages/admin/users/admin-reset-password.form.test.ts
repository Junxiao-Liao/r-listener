import { describe, expect, it } from 'vitest';
import { validateAdminResetPassword } from './admin-reset-password.form';

describe('admin reset password form', () => {
	it('rejects passwords that do not match the backend strength policy', () => {
		expect(validateAdminResetPassword('short1!')).toEqual({
			ok: false,
			error: 'weak_password'
		});
		expect(validateAdminResetPassword('longbutnoclasses')).toEqual({
			ok: false,
			error: 'weak_password'
		});
	});

	it('accepts passwords with at least 12 characters and 3 character classes', () => {
		expect(validateAdminResetPassword('lowercase123!')).toEqual({ ok: true });
		expect(validateAdminResetPassword('LongPassword!')).toEqual({ ok: true });
		expect(validateAdminResetPassword('LOWERCASE123!')).toEqual({ ok: true });
	});
});
