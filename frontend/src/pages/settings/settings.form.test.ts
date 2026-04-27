import { describe, expect, it } from 'vitest';
import { superValidate, zod } from '$shared/forms/superforms';
import { preferencesSchema } from './settings.form';

describe('preferencesSchema', () => {
	it('accepts an empty patch', () => {
		expect(preferencesSchema.safeParse({}).success).toBe(true);
	});

	it('accepts a partial patch', () => {
		const r = preferencesSchema.safeParse({ language: 'zh', theme: 'dark', autoPlayNext: true });
		expect(r.success).toBe(true);
	});

	it('parses native checkbox values without treating "false" as true', () => {
		const r = preferencesSchema.safeParse({
			autoPlayNext: 'false',
			showMiniPlayer: ['false', 'true'],
			preferSyncedLyrics: 'on'
		});

		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data).toMatchObject({
			autoPlayNext: false,
			showMiniPlayer: true,
			preferSyncedLyrics: true
		});
	});

	it('parses a native FormData preferences submit', async () => {
		const formData = new FormData();
		formData.append('language', 'zh');
		formData.append('theme', 'dark');
		formData.append('autoPlayNext', 'false');
		formData.append('showMiniPlayer', 'false');
		formData.append('showMiniPlayer', 'true');
		formData.append('preferSyncedLyrics', 'false');
		formData.append('defaultLibrarySort', 'artist:asc');

		const form = await superValidate(formData, zod(preferencesSchema));

		expect(form.valid).toBe(true);
		expect(form.data).toEqual({
			language: 'zh',
			theme: 'dark',
			autoPlayNext: false,
			showMiniPlayer: true,
			preferSyncedLyrics: false,
			defaultLibrarySort: 'artist:asc'
		});
	});

	it('rejects invalid language and sort', () => {
		expect(preferencesSchema.safeParse({ language: 'fr' }).success).toBe(false);
		expect(preferencesSchema.safeParse({ theme: 'sepia' }).success).toBe(false);
		expect(preferencesSchema.safeParse({ defaultLibrarySort: 'bogus' }).success).toBe(false);
	});
});
