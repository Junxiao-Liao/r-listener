import { describe, expect, it } from 'vitest';
import { swapUploadItemTitleAndArtists, type UploadItem } from './upload.types';

describe('upload item helpers', () => {
	it('swaps title and artists for filename metadata correction', () => {
		expect(
			swapUploadItemTitleAndArtists(uploadItem({ title: 'Song', artistNames: ['A', 'B'] }))
		).toMatchObject({
			title: 'A, B',
			artistNames: ['Song']
		});
	});
});

function uploadItem(overrides: Partial<UploadItem>): UploadItem {
	return {
		id: 'up_a',
		audio: new File(['audio'], 'song.mp3', { type: 'audio/mpeg' }),
		externalLrc: null,
		resolvedLyricsLrc: null,
		lyricsSource: 'none',
		embeddedCover: null,
		title: 'Title',
		artistNames: [],
		album: null,
		trackNumber: null,
		genre: null,
		year: null,
		durationMs: null,
		...overrides
	};
}
