import { argon2id } from '@noble/hashes/argon2.js';

// OWASP 2024 guidance: m=19 MiB, t=2, p=1, output 32 bytes.
const PARAMS = { p: 1, t: 2, m: 19456, dkLen: 32 } as const;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = argon2id(password, salt, PARAMS);
	return `${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
	const [saltHex, hashHex] = encoded.split('$');
	if (!saltHex || !hashHex) return false;
	const salt = hexToBytes(saltHex);
	const expected = hexToBytes(hashHex);
	const actual = argon2id(password, salt, PARAMS);
	return timingSafeEqual(actual, expected);
}

function bytesToHex(bytes: Uint8Array): string {
	let hex = '';
	for (const b of bytes) {
		hex += b.toString(16).padStart(2, '0');
	}
	return hex;
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		// Index is bounded by a.length and lengths are equal, so both reads are defined.
		diff |= a[i]! ^ b[i]!;
	}
	return diff === 0;
}
