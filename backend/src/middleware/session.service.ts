import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import {
	getSessionFromKv,
	refreshSessionInKv,
	toSessionContext
} from '../lib/session-kv';
import { cacheKey, createKvCache, KV_TTL } from '../lib/kv-cache';
import { toIso8601 } from '../shared/time';
import { users } from '../users/users.orm';
import type { SessionValidationInput, SessionValidationResult } from './middleware.type';

type CachedSessionUser = SessionValidationResult['user'] & { deletedAt: string | null };

export async function validateSession(
	kv: KVNamespace,
	db: Db,
	input: SessionValidationInput
): Promise<SessionValidationResult | null> {
	const sessionData = await getSessionFromKv(kv, input.token, input.now);
	if (!sessionData) return null;
	const cache = createKvCache(kv, { defaultTtlSeconds: KV_TTL.authz });

	const user = await cache.get<CachedSessionUser>(
		cacheKey('cache:session:user', sessionData.userId),
		async () => {
			const userRows = await db
				.select()
				.from(users)
				.where(eq(users.id, sessionData.userId))
				.limit(1);
			const row = userRows[0];
			if (!row) return null;
			return {
				id: row.id as SessionValidationResult['user']['id'],
				username: row.username,
				isAdmin: row.isAdmin,
				isActive: row.isActive,
				lastActiveTenantId: row.lastActiveTenantId as SessionValidationResult['user']['lastActiveTenantId'],
				createdAt: toIso8601(row.createdAt),
				deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
			};
		}
	);

	if (!user || !user.isActive || user.deletedAt) return null;

	const { sessionExpiresAt, refreshedSessionExpiresAt } = await refreshSessionInKv(kv, {
		session: sessionData,
		now: input.now
	});

	const result = toSessionContext(
		sessionData,
		user,
		toIso8601(sessionExpiresAt),
		refreshedSessionExpiresAt ? toIso8601(refreshedSessionExpiresAt) : null
	);

	return {
		...result.session,
		refreshedSessionExpiresAt: result.refreshedSessionExpiresAt
	} as SessionValidationResult;
}
