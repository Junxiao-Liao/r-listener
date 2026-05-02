import { describe, it, expect } from 'vitest';
import { renameArtist, dedupeArtistNames, artistDisplayName } from './artists';

describe('renameArtist', () => {
	it('renames an existing artist', () => {
		expect(renameArtist(['Alice', 'Bob'], 'Bob', 'Bobby')).toEqual(['Alice', 'Bobby']);
	});

	it('renames case-insensitively', () => {
		expect(renameArtist(['ALICE', 'bob'], 'Bob', 'Bobby')).toEqual(['ALICE', 'Bobby']);
	});

	it('deletes artist when new name is empty', () => {
		expect(renameArtist(['Alice', 'Bob'], 'Bob', '   ')).toEqual(['Alice']);
	});

	it('returns unchanged array when old name not found', () => {
		expect(renameArtist(['Alice', 'Bob'], 'Charlie', 'Charles')).toEqual(['Alice', 'Bob']);
	});

	it('returns unchanged array when new name equals old name', () => {
		expect(renameArtist(['Alice', 'Bob'], 'Bob', 'Bob')).toEqual(['Alice', 'Bob']);
	});

	it('handles empty array', () => {
		expect(renameArtist([], 'Alice', 'Ally')).toEqual([]);
	});

	it('handles unicode normalization in match', () => {
		expect(renameArtist(['Björk'], 'björk', 'Bjørk')).toEqual(['Bjørk']);
	});

	it('renames all case-insensitive matches', () => {
		expect(renameArtist(['Alice', 'Alice'], 'Alice', 'Ally')).toEqual(['Ally', 'Ally']);
	});
});

describe('dedupeArtistNames', () => {
	it('dedupes case-insensitive duplicates', () => {
		expect(dedupeArtistNames(['Alice', 'ALICE', 'alice'])).toEqual(['Alice']);
	});

	it('keeps first occurrence', () => {
		expect(dedupeArtistNames(['Bob', 'Alice', 'bob'])).toEqual(['Bob', 'Alice']);
	});

	it('trims whitespace', () => {
		expect(dedupeArtistNames(['  Alice  ', 'Bob'])).toEqual(['Alice', 'Bob']);
	});

	it('removes empty strings', () => {
		expect(dedupeArtistNames(['', 'Alice', '   '])).toEqual(['Alice']);
	});

	it('returns empty for all empty inputs', () => {
		expect(dedupeArtistNames(['', '  '])).toEqual([]);
	});
});

describe('artistDisplayName', () => {
	it('joins names with comma', () => {
		expect(artistDisplayName([{ name: 'Alice' }, { name: 'Bob' }])).toBe('Alice, Bob');
	});

	it('returns empty string for empty array', () => {
		expect(artistDisplayName([])).toBe('');
	});
});
