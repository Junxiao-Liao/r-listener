import { describe, expect, it } from 'vitest';
import { preferencesSchema } from './settings.form';

describe('preferencesSchema', () => {
	it('accepts an empty patch', () => {
		expect(preferencesSchema.safeParse({}).success).toBe(true);
	});

	it('accepts a partial patch', () => {
		const r = preferencesSchema.safeParse({ language: 'zh', autoPlayNext: true });
		expect(r.success).toBe(true);
	});

	it('rejects invalid language and sort', () => {
		expect(preferencesSchema.safeParse({ language: 'fr' }).success).toBe(false);
		expect(preferencesSchema.safeParse({ defaultLibrarySort: 'bogus' }).success).toBe(false);
	});
});
