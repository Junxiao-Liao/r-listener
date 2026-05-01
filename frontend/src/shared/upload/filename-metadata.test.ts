import { describe, expect, it } from 'vitest';
import { parseFilenameMetadata, splitArtistNames } from './filename-metadata';

describe('filename metadata parsing', () => {
	it('strips extension and splits title from artists on the first dash variant', () => {
		expect(parseFilenameMetadata('Song Title - Artist A, Artist B.mp3')).toEqual({
			baseTitle: 'Song Title - Artist A, Artist B',
			title: 'Song Title',
			artistNames: ['Artist A', 'Artist B']
		});
		expect(parseFilenameMetadata('歌曲名 — 歌手甲、歌手乙.flac').artistNames).toEqual([
			'歌手甲',
			'歌手乙'
		]);
	});

	it('keeps the base filename when no dash-separated artist segment exists', () => {
		expect(parseFilenameMetadata('No Artist.m4a')).toEqual({
			baseTitle: 'No Artist',
			title: null,
			artistNames: []
		});
	});

	it('splits artist lists, drops blanks, and dedupes by casefold key', () => {
		expect(splitArtistNames('A, B，a、 C ；  ')).toEqual(['A', 'B', 'C']);
	});
});
