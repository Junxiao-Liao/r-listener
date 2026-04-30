import { argon2id } from '@noble/hashes/argon2.js';

const PBKDF2_ALGORITHM = 'pbkdf2-sha256';
const PBKDF2_ITERATIONS = 100_000;
const MAX_WORKER_PBKDF2_ITERATIONS = 100_000;
const SALT_BYTE_LENGTH = 16;
const HASH_BYTE_LENGTH = 32;

// Legacy hashes were generated with synchronous JS Argon2id. Keep verification
// for existing rows, but do not use it for new hashes in Workers.
const LEGACY_ARGON2ID_PARAMS = { p: 1, t: 2, m: 19456, dkLen: HASH_BYTE_LENGTH } as const;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
	const hash = await pbkdf2Sha256(password, salt, PBKDF2_ITERATIONS);
	return [PBKDF2_ALGORITHM, PBKDF2_ITERATIONS, bytesToHex(salt), bytesToHex(hash)].join('$');
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
	if (isPbkdf2PasswordHash(encoded)) {
		const parsed = parsePbkdf2Hash(encoded);
		if (!parsed) return false;
		try {
			const actual = await pbkdf2Sha256(password, parsed.salt, parsed.iterations);
			return timingSafeEqual(actual, parsed.hash);
		} catch {
			return false;
		}
	}

	const [saltHex, hashHex] = encoded.split('$');
	if (!saltHex || !hashHex) return false;
	const salt = hexToBytes(saltHex);
	const expected = hexToBytes(hashHex);
	if (!salt || !expected) return false;

	try {
		const actual = argon2id(password, salt, LEGACY_ARGON2ID_PARAMS);
		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

export function isPbkdf2PasswordHash(encoded: string): boolean {
	return encoded.startsWith(`${PBKDF2_ALGORITHM}$`);
}

async function pbkdf2Sha256(
	password: string,
	salt: Uint8Array,
	iterations: number
): Promise<Uint8Array> {
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		keyMaterial,
		HASH_BYTE_LENGTH * 8
	);
	return new Uint8Array(bits);
}

function parsePbkdf2Hash(encoded: string) {
	const parts = encoded.split('$');
	if (parts.length !== 4) return null;
	const [algorithm, iterationsText, saltHex, hashHex] = parts;
	if (algorithm !== PBKDF2_ALGORITHM || !iterationsText || !saltHex || !hashHex) return null;

	const iterations = Number(iterationsText);
	if (
		!Number.isSafeInteger(iterations) ||
		iterations < 1 ||
		iterations > MAX_WORKER_PBKDF2_ITERATIONS
	) {
		return null;
	}

	const salt = hexToBytes(saltHex);
	const hash = hexToBytes(hashHex);
	if (!salt || !hash || salt.length !== SALT_BYTE_LENGTH || hash.length !== HASH_BYTE_LENGTH) {
		return null;
	}

	return { iterations, salt, hash };
}

function bytesToHex(bytes: Uint8Array): string {
	let hex = '';
	for (const b of bytes) {
		hex += b.toString(16).padStart(2, '0');
	}
	return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
	if (hex.length === 0 || hex.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(hex)) return null;
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
