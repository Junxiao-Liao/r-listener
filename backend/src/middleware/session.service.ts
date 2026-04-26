import { eq } from 'drizzle-orm';
import { SESSION_TTL_MS, hashSessionToken } from '../auth/session';
import { sessions } from '../auth/auth.orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { toIso8601 } from '../shared/time';
import { users } from '../users/users.orm';
import type {
	SessionContext,
	SessionValidationInput,
	SessionValidationResult
} from './middleware.type';

const SESSION_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24;

export async function validateSession(
	db: Db,
	input: SessionValidationInput
): Promise<SessionValidationResult | null> {
	const tokenHash = hashSessionToken(input.token);
	const rows = await db
		.select({ session: sessions, user: users })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.tokenHash, tokenHash))
		.limit(1);
	const row = rows[0];

	if (!row || !row.user.isActive || row.user.deletedAt) {
		return null;
	}

	if (row.session.expiresAt.getTime() <= input.now.getTime()) {
		await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
		return null;
	}

	const shouldRefresh =
		input.now.getTime() - row.session.lastRefreshedAt.getTime() >= SESSION_REFRESH_INTERVAL_MS;
	const sessionExpiresAt = shouldRefresh
		? new Date(input.now.getTime() + SESSION_TTL_MS)
		: row.session.expiresAt;

	if (shouldRefresh) {
		await db
			.update(sessions)
			.set({
				expiresAt: sessionExpiresAt,
				lastRefreshedAt: input.now
			})
			.where(eq(sessions.tokenHash, tokenHash));
	}

	return {
		user: {
			id: row.user.id as SessionContext['user']['id'],
			username: row.user.username,
			isAdmin: row.user.isAdmin,
			isActive: row.user.isActive,
			lastActiveTenantId: row.user.lastActiveTenantId as SessionContext['user']['lastActiveTenantId'],
			createdAt: toIso8601(row.user.createdAt)
		},
		sessionTokenHash: tokenHash,
		activeTenantId: row.session.activeTenantId as Id<'tenant'> | null,
		role: null,
		sessionExpiresAt: toIso8601(sessionExpiresAt),
		refreshedSessionExpiresAt: shouldRefresh ? toIso8601(sessionExpiresAt) : null
	};
}
