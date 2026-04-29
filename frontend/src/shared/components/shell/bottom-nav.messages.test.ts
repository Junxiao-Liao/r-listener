import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import zh from '../../../../messages/zh.json';

const bottomNavKeys = [
	'nav_home',
	'nav_library',
	'nav_playlists',
	'nav_settings'
] as const;

describe('bottom nav messages', () => {
	it('defines fallback labels in English and Chinese', () => {
		for (const key of bottomNavKeys) {
			expect(en[key]).toEqual(expect.any(String));
			expect(zh[key]).toEqual(expect.any(String));
			expect(en[key].length).toBeGreaterThan(0);
			expect(zh[key].length).toBeGreaterThan(0);
		}
	});
});
