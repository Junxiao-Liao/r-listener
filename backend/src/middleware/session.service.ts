import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import {
	getSessionFromKv,
	refreshSessionInKv,
	toSessionContext
} from '../lib/session-kv';
import { toIso8601 } from '../shared/time';
import { users } from '../users/users.orm';
import type { SessionValidationInput, SessionValidationResult } from './middleware.type';

export async function validateSession(
	kv: KVNamespace,
	db: Db,
	input: SessionValidationInput
): Promise<SessionValidationResult | null> {
	const sessionData = await getSessionFromKv(kv, input.token);
	if (!sessionData) return null;

	const userRows = await db
		.select()
		.from(users)
		.where(eq(users.id, sessionData.userId))
		.limit(1);

	const userRow = userRows[0];
	if (!userRow || !userRow.isActive || userRow.deletedAt) return null;

	const { sessionExpiresAt, refreshedSessionExpiresAt } = await refreshSessionInKv(kv, {
		session: sessionData,
		now: input.now
	});

	const result = toSessionContext(
		sessionData,
		{
			id: userRow.id as SessionValidationResult['user']['id'],
			username: userRow.username,
			isAdmin: userRow.isAdmin,
			isActive: userRow.isActive,
			lastActiveTenantId: userRow.lastActiveTenantId as SessionValidationResult['user']['lastActiveTenantId'],
			createdAt: toIso8601(userRow.createdAt)
		},
		toIso8601(sessionExpiresAt),
		refreshedSessionExpiresAt ? toIso8601(refreshedSessionExpiresAt) : null
	);

	return {
		...result.session,
		refreshedSessionExpiresAt: result.refreshedSessionExpiresAt
	} as SessionValidationResult;
}
