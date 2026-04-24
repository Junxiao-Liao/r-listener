import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';

// Oslo-style session tokens: client holds a random token; DB stores only
// its SHA-256 hash, so a leaked DB never leaks valid session cookies.

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(20));
	return encodeBase32LowerCaseNoPadding(bytes);
}

export function hashSessionToken(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// DB persistence lives in a repository once `sessions` table is defined:
//   createSession(db, userId) -> { token, expiresAt }     // insert hash
//   validateSessionToken(db, token) -> { session, user } | null  // lookup + sliding renewal
//   invalidateSession(db, token)
