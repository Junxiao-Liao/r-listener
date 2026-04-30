import { internalError } from '../http/api-error';
import type { ApiRateLimitInput, ApiRateLimitResult, AuthRateLimitInput, AuthRateLimitResult } from './middleware.type';

const AUTH_RATE_LIMIT_MAX = 10;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

const API_RATE_LIMIT_MAX = 60;
const API_RATE_LIMIT_WINDOW_SECONDS = 60;

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
	} catch (err) {
		console.error('checkAuthRateLimit error:', err);
		throw internalError();
	}
}

export async function checkApiRateLimit(
	kv: KVNamespace,
	input: ApiRateLimitInput
): Promise<ApiRateLimitResult> {
	const windowStart = Math.floor(input.now.getTime() / (API_RATE_LIMIT_WINDOW_SECONDS * 1000));
	const key = `rate:api:${input.userId}:${windowStart}`;

	try {
		const current = Number((await kv.get(key)) ?? '0');
		const next = current + 1;
		await kv.put(key, String(next), { expirationTtl: API_RATE_LIMIT_WINDOW_SECONDS });

		return { allowed: next <= API_RATE_LIMIT_MAX };
	} catch (err) {
		console.error('checkApiRateLimit error:', err);
		throw internalError();
	}
}
