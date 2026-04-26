import { z } from 'zod';

export const languageSchema = z.enum(['en', 'zh']);
export const librarySortSchema = z.enum([
	'createdAt:desc',
	'title:asc',
	'artist:asc',
	'album:asc'
]);

export const preferencesSchema = z.object({
	language: languageSchema.optional(),
	autoPlayNext: z.coerce.boolean().optional(),
	showMiniPlayer: z.coerce.boolean().optional(),
	preferSyncedLyrics: z.coerce.boolean().optional(),
	defaultLibrarySort: librarySortSchema.optional()
});

export type PreferencesForm = z.infer<typeof preferencesSchema>;

export const defaultPreferencesForm: PreferencesForm = {};
