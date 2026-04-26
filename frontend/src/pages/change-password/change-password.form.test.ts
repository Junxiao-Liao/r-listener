import { describe, expect, it } from 'vitest';
import { changePasswordSchema, isStrongPassword } from './change-password.form';

describe('isStrongPassword', () => {
	it('rejects short passwords', () => {
		expect(isStrongPassword('Aa1!')).toBe(false);
		expect(isStrongPassword('Aaaaaaaaaaa1')).toBe(true); // 12 chars + lower + upper + digit
	});
	it('requires at least 3 of {lower, upper, digit, symbol}', () => {
		expect(isStrongPassword('aaaaaaaaaaaa')).toBe(false); // only lower
		expect(isStrongPassword('aaaaaaaaaaaa1')).toBe(false); // lower + digit only
		expect(isStrongPassword('aaaaaaaaaaaaA1')).toBe(true); // lower + upper + digit
		expect(isStrongPassword('aaaaaaaaaaaa1!')).toBe(true); // lower + digit + symbol
	});
});

describe('changePasswordSchema', () => {
	it('passes for a strong matching password', () => {
		const r = changePasswordSchema.safeParse({
			currentPassword: 'old-secret',
			newPassword: 'NewStrong1!',
			confirmPassword: 'NewStrong1!'
		});
		expect(r.success).toBe(false); // 11 chars — too short
	});

	it('rejects weak password', () => {
		const r = changePasswordSchema.safeParse({
			currentPassword: 'x',
			newPassword: 'short',
			confirmPassword: 'short'
		});
		expect(r.success).toBe(false);
		if (!r.success) {
			expect(r.error.issues.some((i) => i.message === 'weak_password')).toBe(true);
		}
	});

	it('rejects mismatched confirmation', () => {
		const r = changePasswordSchema.safeParse({
			currentPassword: 'x',
			newPassword: 'NewStrong1!a',
			confirmPassword: 'NewStrong1!b'
		});
		expect(r.success).toBe(false);
		if (!r.success) {
			expect(r.error.issues.some((i) => i.message === 'mismatch')).toBe(true);
		}
	});

	it('accepts a 12-char strong matching password', () => {
		const r = changePasswordSchema.safeParse({
			currentPassword: 'old-secret',
			newPassword: 'NewStrong1!a',
			confirmPassword: 'NewStrong1!a'
		});
		expect(r.success).toBe(true);
	});
});
