import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import type { UserId } from '../users/users.type';
import { userPreferences } from './prefs.orm';
import { toPreferencesDto } from './prefs.dto';
import type { PreferencesDto, PreferencesPatch } from './prefs.type';
import type { KvCache } from '../lib/kv-cache';
import { createKvCache } from '../lib/kv-cache';

export type PrefsRepository = {
	findByUserId(userId: UserId): Promise<PreferencesDto | null>;
	createDefault(input: { userId: UserId; now: Date }): Promise<PreferencesDto>;
	update(input: { userId: UserId; patch: PreferencesPatch; now: Date }): Promise<PreferencesDto>;
};

function prefsKey(userId: UserId): string {
	return `prefs:${userId}`;
}

export function createPrefsRepository(db: Db, kv?: KVNamespace): PrefsRepository {
	const cache = kv ? createKvCache(kv, { defaultTtlSeconds: 600 }) : null;

	return {
		findByUserId: async (userId) => {
			if (cache) {
				const cached = await cache.tryGet<PreferencesDto>(prefsKey(userId));
				if (cached) return cached;
			}

			const rows = await db
				.select()
				.from(userPreferences)
				.where(eq(userPreferences.userId, userId))
				.limit(1);

			const result = rows[0] ? toPreferencesDto(rows[0]) : null;
			if (cache && result) {
				await cache.put(prefsKey(userId), result);
			}
			return result;
		},
		createDefault: async ({ userId, now }) => {
			await db
				.insert(userPreferences)
				.values({ userId, updatedAt: now })
				.onConflictDoNothing({ target: userPreferences.userId });
			const created = await db
				.select()
				.from(userPreferences)
				.where(eq(userPreferences.userId, userId))
				.limit(1);
			if (!created[0]) {
				throw new Error('failed to create preferences');
			}
			const dto = toPreferencesDto(created[0]);
			if (cache) await cache.put(prefsKey(userId), dto);
			return dto;
		},
		update: async ({ userId, patch, now }) => {
			const rows = await db
				.update(userPreferences)
				.set({ ...patch, updatedAt: now })
				.where(eq(userPreferences.userId, userId))
				.returning();
			if (rows[0]) {
				const dto = toPreferencesDto(rows[0]);
				if (cache) await cache.put(prefsKey(userId), dto);
				return dto;
			}
			await db.insert(userPreferences).values({ userId, ...patch, updatedAt: now });
			const created = await db
				.select()
				.from(userPreferences)
				.where(eq(userPreferences.userId, userId))
				.limit(1);
			if (!created[0]) {
				throw new Error('failed to update preferences');
			}
			const dto = toPreferencesDto(created[0]);
			if (cache) await cache.put(prefsKey(userId), dto);
			return dto;
		}
	};
}
