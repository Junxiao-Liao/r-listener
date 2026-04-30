import { describe, expect, it } from 'vitest';
import { hashPassword, isPbkdf2PasswordHash, verifyPassword } from './password';

describe('password hashing', () => {
	it('stores new passwords with the worker-friendly PBKDF2 format', async () => {
		const encoded = await hashPassword('Stronger123!');

		expect(isPbkdf2PasswordHash(encoded)).toBe(true);
		expect(encoded).toMatch(/^pbkdf2-sha256\$50000\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
	});

	it('verifies matching PBKDF2 passwords and rejects mismatches', async () => {
		const encoded = await hashPassword('Stronger123!');

		await expect(verifyPassword('Stronger123!', encoded)).resolves.toBe(true);
		await expect(verifyPassword('Wronger123!', encoded)).resolves.toBe(false);
	});

	it('rejects legacy Argon2id hashes without spending Worker CPU', async () => {
		const legacyHash =
			'000102030405060708090a0b0c0d0e0f$ee8ec0beb1f917833bd0d655bda6c37e299eae4c26d4ea28d6b6e71fb9aa34f2';

		await expect(verifyPassword('Stronger123!', legacyHash)).resolves.toBe(false);
		await expect(verifyPassword('Wronger123!', legacyHash)).resolves.toBe(false);
	});

	it('treats malformed password hashes as non-matches', async () => {
		await expect(verifyPassword('Stronger123!', 'not-a-hash')).resolves.toBe(false);
		await expect(verifyPassword('Stronger123!', 'pbkdf2-sha256$nope$salt$hash')).resolves.toBe(
			false
		);
	});

	it('rejects PBKDF2 hashes above the app iteration cap', async () => {
		const unsupported =
			'pbkdf2-sha256$50001$000102030405060708090a0b0c0d0e0f$000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f';

		await expect(verifyPassword('Stronger123!', unsupported)).resolves.toBe(false);
	});
});
