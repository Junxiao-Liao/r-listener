import { internalError } from '../http/api-error';
import type { AuthRateLimitInput, AuthRateLimitResult } from './middleware.type';

const AUTH_RATE_LIMIT_MAX = 10;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

export async function checkAuthRateLimit(
	kv: KVNamespace,
	input: AuthRateLimitInput
): Promise<AuthRateLimitResult> {
	const windowStart = Math.floor(input.now.getTime() / (AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000));
	const key = `rate:auth:${encodeURIComponent(input.ip)}:${windowStart}`;

	try {
		const current = Number((await kv.get(key)) ?? '0');
		const next = current + 1;
		await kv.put(key, String(next), { expirationTtl: AUTH_RATE_LIMIT_WINDOW_SECONDS });

		return { allowed: next <= AUTH_RATE_LIMIT_MAX };
	} catch {
		throw internalError();
	}
}
