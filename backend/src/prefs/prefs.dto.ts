import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { PreferencesDto } from './prefs.type';
import type { userPreferences } from './prefs.orm';

export const preferencesDtoSchema = z.object({
	language: z.enum(['en', 'zh']),
	autoPlayNext: z.boolean(),
	showMiniPlayer: z.boolean(),
	preferSyncedLyrics: z.boolean(),
	defaultLibrarySort: z.enum(['createdAt:desc', 'title:asc', 'artist:asc', 'album:asc']),
	updatedAt: z.string()
});

export const preferencesPatchSchema = preferencesDtoSchema
	.pick({
		language: true,
		autoPlayNext: true,
		showMiniPlayer: true,
		preferSyncedLyrics: true,
		defaultLibrarySort: true
	})
	.partial();

export function toPreferencesDto(preferences: typeof userPreferences.$inferSelect): PreferencesDto {
	return {
		language: preferences.language,
		autoPlayNext: preferences.autoPlayNext,
		showMiniPlayer: preferences.showMiniPlayer,
		preferSyncedLyrics: preferences.preferSyncedLyrics,
		defaultLibrarySort: preferences.defaultLibrarySort,
		updatedAt: fromUnixTimestampSeconds(preferences.updatedAt)
	};
}
