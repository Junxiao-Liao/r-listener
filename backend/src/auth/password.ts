import { argon2id, argon2Verify } from 'hash-wasm';

// Workers-compatible argon2id (pure WASM; no native bindings).
// Params chosen to stay well under Worker CPU limits while following
// OWASP 2024 guidance: m=19 MiB, t=2, p=1, output 32 bytes.
const PARAMS = { parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32 } as const;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	return argon2id({ password, salt, ...PARAMS, outputType: 'encoded' });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
	return argon2Verify({ password, hash });
}
