import { describe, expect, it } from 'vitest';
import { preferencesPatchSchema } from './prefs.dto';

describe('preferencesPatchSchema', () => {
	it('accepts empty patches', () => {
		expect(preferencesPatchSchema.safeParse({}).success).toBe(true);
	});

	it('accepts supported theme values', () => {
		for (const theme of ['system', 'light', 'dark']) {
			expect(preferencesPatchSchema.safeParse({ theme }).success).toBe(true);
		}
	});

	it('rejects unsupported theme values', () => {
		expect(preferencesPatchSchema.safeParse({ theme: 'sepia' }).success).toBe(false);
	});
});
