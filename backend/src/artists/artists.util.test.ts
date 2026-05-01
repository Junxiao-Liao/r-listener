import { describe, expect, it } from 'vitest';
import { artistNameKey, dedupeArtistNames } from './artists.util';

describe('artist utilities', () => {
	it('builds a trimmed casefold name key', () => {
		expect(artistNameKey('  Ａdele  ')).toBe('adele');
	});

	it('dedupes artist names by trimmed casefold key while preserving first display casing', () => {
		expect(dedupeArtistNames([' Adele ', 'adele', '', 'Beyonce'])).toEqual([
			'Adele',
			'Beyonce'
		]);
	});
});
