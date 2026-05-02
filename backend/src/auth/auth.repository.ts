import { and, eq, ne } from 'drizzle-orm';
import type { Id } from '../shared/shared.type';
import type { UserId } from '../users/users.type';
import type { Db } from '../db';
import { generateSessionToken, hashSessionToken, SESSION_TTL_MS } from './session';
import { sessions } from './auth.orm';

export type AuthRepository = {
	createSession(input: {
		userId: UserId;
		activeTenantId: Id<'tenant'> | null;
		now: Date;
		ip: string | null;
		userAgent: string | null;
	}): Promise<{ token: string; tokenHash: string; expiresAt: Date }>;
	deleteSession(sessionTokenHash: string): Promise<void>;
	setSessionActiveTenant(input: {
		sessionTokenHash: string;
		tenantId: Id<'tenant'>;
	}): Promise<void>;
	deleteSiblingSessions(input: {
		userId: UserId;
		currentSessionTokenHash: string;
	}): Promise<void>;
};

export function createAuthRepository(db: Db): AuthRepository {
	return {
		createSession: async ({ userId, activeTenantId, now, ip, userAgent }) => {
			const token = generateSessionToken();
			const tokenHash = hashSessionToken(token);
			const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
			await db.insert(sessions).values({
				tokenHash,
				userId,
				activeTenantId,
				expiresAt,
				lastRefreshedAt: now,
				createdAt: now,
				ip,
				userAgent
			});
			return { token, tokenHash, expiresAt };
		},
		deleteSession: async (sessionTokenHash) => {
			await db.delete(sessions).where(eq(sessions.tokenHash, sessionTokenHash));
		},
		setSessionActiveTenant: async ({ sessionTokenHash, tenantId }) => {
			await db
				.update(sessions)
				.set({ activeTenantId: tenantId })
				.where(eq(sessions.tokenHash, sessionTokenHash));
		},
		deleteSiblingSessions: async ({ userId, currentSessionTokenHash }) => {
			await db
				.delete(sessions)
				.where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, currentSessionTokenHash)));
		}
	};
}
