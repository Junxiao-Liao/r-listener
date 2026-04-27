import { z } from 'zod';

export const languageSchema = z.enum(['en', 'zh']);
export const librarySortSchema = z.enum([
	'createdAt:desc',
	'title:asc',
	'artist:asc',
	'album:asc'
]);

const checkboxBooleanSchema = z.preprocess((value) => {
	const scalar = Array.isArray(value) ? value.at(-1) : value;
	if (scalar === undefined) return undefined;
	if (scalar === true || scalar === 'true' || scalar === 'on') return true;
	if (scalar === false || scalar === 'false' || scalar === 'off' || scalar === '') return false;
	return scalar;
}, z.boolean().optional());

export const preferencesSchema = z.object({
	language: languageSchema.optional(),
	autoPlayNext: checkboxBooleanSchema,
	showMiniPlayer: checkboxBooleanSchema,
	preferSyncedLyrics: checkboxBooleanSchema,
	defaultLibrarySort: librarySortSchema.optional()
});

export type PreferencesForm = z.infer<typeof preferencesSchema>;

export const defaultPreferencesForm: PreferencesForm = {};
