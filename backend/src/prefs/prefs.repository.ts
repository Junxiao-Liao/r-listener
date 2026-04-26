import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import type { UserId } from '../users/users.type';
import { userPreferences } from './prefs.orm';
import { toPreferencesDto } from './prefs.dto';
import type { PreferencesDto, PreferencesPatch } from './prefs.type';

export type PrefsRepository = {
	findByUserId(userId: UserId): Promise<PreferencesDto | null>;
	createDefault(input: { userId: UserId; now: Date }): Promise<PreferencesDto>;
	update(input: { userId: UserId; patch: PreferencesPatch; now: Date }): Promise<PreferencesDto>;
};

export function createPrefsRepository(db: Db): PrefsRepository {
	return {
		findByUserId: async (userId) => {
			const rows = await db
				.select()
				.from(userPreferences)
				.where(eq(userPreferences.userId, userId))
				.limit(1);
			return rows[0] ? toPreferencesDto(rows[0]) : null;
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
			return toPreferencesDto(created[0]);
		},
		update: async ({ userId, patch, now }) => {
			const rows = await db
				.update(userPreferences)
				.set({ ...patch, updatedAt: now })
				.where(eq(userPreferences.userId, userId))
				.returning();
			if (rows[0]) {
				return toPreferencesDto(rows[0]);
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
			return toPreferencesDto(created[0]);
		}
	};
}
