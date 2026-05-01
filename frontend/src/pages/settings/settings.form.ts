import { z } from 'zod';

export const languageSchema = z.enum(['en', 'zh']);
export const themeSchema = z.enum(['system', 'light', 'dark']);
export const librarySortSchema = z.enum([
	'createdAt:desc',
	'title:asc',
	'album:asc'
]);

export const visualPreferencePatchSchema = z.union([
	z.object({ theme: themeSchema }).strict(),
	z.object({ language: languageSchema }).strict()
]);

export type VisualPreferencePatch = z.infer<typeof visualPreferencePatchSchema>;
