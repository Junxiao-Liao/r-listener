import type { Id } from '../shared/shared.type';
import type { UserId } from '../users/users.type';
import { generateSessionToken } from './session';
import {
	createSessionInKv,
	deleteSession as deleteSessionFromKv,
	deleteSiblingSessionsInKv,
	setSessionActiveTenantInKv
} from '../lib/session-kv';

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

export function createAuthRepository(kv: KVNamespace): AuthRepository {
	return {
		createSession: async ({ userId, activeTenantId, now }) => {
			const token = generateSessionToken();
			const { tokenHash, expiresAt } = await createSessionInKv(kv, {
				token,
				userId,
				activeTenantId,
				now
			});
			return { token, tokenHash, expiresAt };
		},
		deleteSession: async (sessionTokenHash) => {
			await deleteSessionFromKv(kv, sessionTokenHash);
		},
		setSessionActiveTenant: async ({ sessionTokenHash, tenantId }) => {
			await setSessionActiveTenantInKv(kv, { sessionTokenHash, tenantId });
		},
		deleteSiblingSessions: async ({ userId, currentSessionTokenHash }) => {
			await deleteSiblingSessionsInKv(kv, { userId, currentSessionTokenHash });
		}
	};
}
