import type { Id } from '../shared/shared.type';
import { hashSessionToken, SESSION_TTL_MS } from '../auth/session';
import type { SessionContext } from '../middleware/middleware.type';
import type { UserId } from '../users/users.type';

const SESSION_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24;

export type SessionKvData = {
	tokenHash: string;
	userId: UserId;
	activeTenantId: Id<'tenant'> | null;
	expiresAt: number;
	lastRefreshedAt: number;
};

function sessionKey(tokenHash: string): string {
	return `session:${tokenHash}`;
}

export async function getSessionFromKv(kv: KVNamespace, token: string): Promise<SessionKvData | null> {
	const tokenHash = hashSessionToken(token);
	const raw = await kv.get(sessionKey(tokenHash), 'json');
	if (!raw) return null;
	const data = raw as SessionKvData;
	if (data.expiresAt <= Date.now()) {
		await kv.delete(sessionKey(tokenHash));
		return null;
	}
	return data;
}

export async function putSession(kv: KVNamespace, data: SessionKvData): Promise<void> {
	const ttlSeconds = Math.max(1, Math.ceil((data.expiresAt - Date.now()) / 1000));
	await kv.put(sessionKey(data.tokenHash), JSON.stringify(data), { expirationTtl: ttlSeconds });
}

export async function deleteSession(kv: KVNamespace, tokenHash: string): Promise<void> {
	await kv.delete(sessionKey(tokenHash));
}

export async function createSessionInKv(
	kv: KVNamespace,
	input: {
		token: string;
		userId: UserId;
		activeTenantId: Id<'tenant'> | null;
		now: Date;
	}
): Promise<{ tokenHash: string; expiresAt: Date }> {
	const tokenHash = hashSessionToken(input.token);
	const expiresAt = new Date(input.now.getTime() + SESSION_TTL_MS);
	await putSession(kv, {
		tokenHash,
		userId: input.userId,
		activeTenantId: input.activeTenantId,
		expiresAt: expiresAt.getTime(),
		lastRefreshedAt: input.now.getTime()
	});
	return { tokenHash, expiresAt };
}

export async function refreshSessionInKv(
	kv: KVNamespace,
	input: { session: SessionKvData; now: Date }
): Promise<{ sessionExpiresAt: Date; refreshedSessionExpiresAt: Date | null }> {
	const shouldRefresh =
		input.now.getTime() - input.session.lastRefreshedAt >= SESSION_REFRESH_INTERVAL_MS;
	const newExpiresAt = shouldRefresh
		? new Date(input.now.getTime() + SESSION_TTL_MS)
		: new Date(input.session.expiresAt);

	if (shouldRefresh) {
		await putSession(kv, {
			...input.session,
			expiresAt: newExpiresAt.getTime(),
			lastRefreshedAt: input.now.getTime()
		});
		return {
			sessionExpiresAt: newExpiresAt,
			refreshedSessionExpiresAt: newExpiresAt
		};
	}

	return {
		sessionExpiresAt: new Date(input.session.expiresAt),
		refreshedSessionExpiresAt: null
	};
}

export async function setSessionActiveTenantInKv(
	kv: KVNamespace,
	input: { sessionTokenHash: string; tenantId: Id<'tenant'> }
): Promise<void> {
	const raw = await kv.get(sessionKey(input.sessionTokenHash), 'json');
	if (!raw) return;
	const data = raw as SessionKvData;
	data.activeTenantId = input.tenantId;
	const ttlSeconds = Math.max(1, Math.ceil((data.expiresAt - Date.now()) / 1000));
	await kv.put(sessionKey(input.sessionTokenHash), JSON.stringify(data), { expirationTtl: ttlSeconds });
}

export async function deleteSiblingSessionsInKv(
	kv: KVNamespace,
	input: { userId: UserId; currentSessionTokenHash: string }
): Promise<void> {
	const list = await kv.list({ prefix: 'session:' });
	for (const key of list.keys) {
		const raw = await kv.get(key.name, 'json');
		if (!raw) continue;
		const data = raw as SessionKvData;
		if (data.userId === input.userId && data.tokenHash !== input.currentSessionTokenHash) {
			await kv.delete(key.name);
		}
	}
}

export function toSessionContext(
	sessionKvData: SessionKvData,
	user: SessionContext['user'],
	sessionExpiresAt: string,
	refreshedSessionExpiresAt: string | null
): {
	session: SessionContext;
	refreshedSessionExpiresAt: string | null;
} {
	return {
		session: {
			user,
			sessionTokenHash: sessionKvData.tokenHash,
			activeTenantId: sessionKvData.activeTenantId,
			role: null,
			sessionExpiresAt
		},
		refreshedSessionExpiresAt
	};
}
