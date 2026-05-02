import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { internalError } from '../http/api-error';
import type { ApiRateLimitInput, ApiRateLimitResult, AuthRateLimitInput, AuthRateLimitResult } from './middleware.type';
import { rateLimits } from './rate-limit.orm';

const AUTH_RATE_LIMIT_MAX = 10;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

const API_RATE_LIMIT_MAX = 60;
const API_RATE_LIMIT_WINDOW_SECONDS = 60;

export async function checkAuthRateLimit(
	db: Db,
	input: AuthRateLimitInput
): Promise<AuthRateLimitResult> {
	const windowStart = Math.floor(input.now.getTime() / (AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000));
	const key = `rate:auth:${encodeURIComponent(input.ip)}:${windowStart}`;

	try {
		const next = await incrementRateLimit(db, key, input.now, AUTH_RATE_LIMIT_WINDOW_SECONDS);
		return { allowed: next <= AUTH_RATE_LIMIT_MAX };
	} catch (err) {
		console.error('checkAuthRateLimit error:', err);
		throw internalError();
	}
}

export async function checkApiRateLimit(
	db: Db,
	input: ApiRateLimitInput
): Promise<ApiRateLimitResult> {
	const windowStart = Math.floor(input.now.getTime() / (API_RATE_LIMIT_WINDOW_SECONDS * 1000));
	const key = `rate:api:${input.userId}:${windowStart}`;

	try {
		const next = await incrementRateLimit(db, key, input.now, API_RATE_LIMIT_WINDOW_SECONDS);
		return { allowed: next <= API_RATE_LIMIT_MAX };
	} catch (err) {
		console.error('checkApiRateLimit error:', err);
		throw internalError();
	}
}

async function incrementRateLimit(
	db: Db,
	key: string,
	now: Date,
	windowSeconds: number
): Promise<number> {
	const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
	await db
		.insert(rateLimits)
		.values({ key, count: 1, expiresAt })
		.onConflictDoUpdate({
			target: rateLimits.key,
			set: {
				count: sql`${rateLimits.count} + 1`,
				expiresAt
			}
		});

	const rows = await db
		.select({ count: rateLimits.count })
		.from(rateLimits)
		.where(eq(rateLimits.key, key))
		.limit(1);
	return Number(rows[0]?.count ?? 1);
}
