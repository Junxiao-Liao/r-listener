import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { sessions } from '../auth/auth.orm';
import { hashSessionToken, SESSION_TTL_MS } from '../auth/session';
import { toIso8601 } from '../shared/time';
import { users } from '../users/users.orm';
import type { SessionValidationInput, SessionValidationResult } from './middleware.type';

type CachedSessionUser = SessionValidationResult['user'] & { deletedAt: string | null };

export async function validateSession(
	db: Db,
	input: SessionValidationInput
): Promise<SessionValidationResult | null> {
	const sessionTokenHash = hashSessionToken(input.token);
	const sessionRows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.tokenHash, sessionTokenHash))
		.limit(1);
	const session = sessionRows[0];
	if (!session) return null;
	if (session.expiresAt <= input.now) {
		await db.delete(sessions).where(eq(sessions.tokenHash, sessionTokenHash));
		return null;
	}

	const userRows = await db
		.select()
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);
	const row = userRows[0];
	const user: CachedSessionUser | null = row
		? {
				id: row.id as SessionValidationResult['user']['id'],
				username: row.username,
				isAdmin: row.isAdmin,
				isActive: row.isActive,
				lastActiveTenantId: row.lastActiveTenantId as SessionValidationResult['user']['lastActiveTenantId'],
				createdAt: toIso8601(row.createdAt),
				deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
			}
		: null;

	if (!user || !user.isActive || user.deletedAt) return null;

	const shouldRefresh =
		input.now.getTime() - session.lastRefreshedAt.getTime() >= SESSION_REFRESH_INTERVAL_MS;
	const sessionExpiresAt = shouldRefresh
		? new Date(input.now.getTime() + SESSION_TTL_MS)
		: session.expiresAt;
	const refreshedSessionExpiresAt = shouldRefresh ? sessionExpiresAt : null;

	if (shouldRefresh) {
		await db
			.update(sessions)
			.set({ expiresAt: sessionExpiresAt, lastRefreshedAt: input.now })
			.where(eq(sessions.tokenHash, sessionTokenHash));
	}

	return {
		user,
		sessionTokenHash,
		activeTenantId: session.activeTenantId as SessionValidationResult['activeTenantId'],
		role: null,
		sessionExpiresAt: toIso8601(sessionExpiresAt) as SessionValidationResult['sessionExpiresAt'],
		refreshedSessionExpiresAt: refreshedSessionExpiresAt
			? toIso8601(refreshedSessionExpiresAt)
			: null
	};
}

const SESSION_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24;
