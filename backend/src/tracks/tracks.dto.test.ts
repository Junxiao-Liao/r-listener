import { describe, expect, it } from 'vitest';
import {
	createTrackInputSchema,
	finalizeTrackInputSchema,
	lyricsInputSchema,
	trackQuerySchema,
	updateTrackInputSchema
} from './tracks.dto';

describe('track DTO schemas', () => {
	describe('createTrackInputSchema', () => {
		it('accepts optional metadata fields', () => {
			const result = createTrackInputSchema.parse({
				title: 'My Song',
				artistNames: ['Artist Name'],
				album: 'Album Name'
			});
			expect(result).toEqual({ title: 'My Song', artistNames: ['Artist Name'], album: 'Album Name' });
		});

		it('accepts empty object', () => {
			expect(createTrackInputSchema.parse({})).toEqual({ artistNames: [] });
		});

		it('rejects empty strings for optional fields', () => {
			expect(() => createTrackInputSchema.parse({ title: '' })).toThrow();
			expect(() => createTrackInputSchema.parse({ artistNames: [''] })).toThrow();
		});
	});

	describe('trackQuerySchema', () => {
		it('defaults to empty query', () => {
			const result = trackQuerySchema.parse({});
			expect(result).toEqual({
				includePending: false
			});
		});

		it('parses q and includePending', () => {
			const result = trackQuerySchema.parse({
				q: 'test',
				includePending: 'true'
			});
			expect(result.q).toBe('test');
			expect(result.includePending).toBe(true);
		});

		it('coerces includePending', () => {
			expect(trackQuerySchema.parse({ includePending: 'true' }).includePending).toBe(true);
			expect(trackQuerySchema.parse({ includePending: 'false' }).includePending).toBe(false);
		});

		it('strips unknown query params', () => {
			const result = trackQuerySchema.parse({ sort: 'createdAt:desc', limit: '50', cursor: 'abc' });
			expect(result.includePending).toBe(false);
		});
	});

	describe('finalizeTrackInputSchema', () => {
		it('requires durationMs', () => {
			expect(() => finalizeTrackInputSchema.parse({})).toThrow();
		});

		it('accepts durationMs with optional fields', () => {
			const result = finalizeTrackInputSchema.parse({
				durationMs: 180000,
				lyricsLrc: '[00:01.00]Hello',
				trackNumber: 1,
				genre: 'Pop',
				year: 2024
			});
			expect(result.durationMs).toBe(180000);
			expect(result.lyricsLrc).toBe('[00:01.00]Hello');
			expect(result.trackNumber).toBe(1);
		});

		it('rejects negative durationMs', () => {
			expect(() => finalizeTrackInputSchema.parse({ durationMs: -1 })).toThrow();
		});

		it('rejects zero durationMs', () => {
			expect(() => finalizeTrackInputSchema.parse({ durationMs: 0 })).toThrow();
		});

		it('rejects duration over 6 hours', () => {
			expect(() => finalizeTrackInputSchema.parse({ durationMs: 21600001 })).toThrow();
		});

		it('validates year range', () => {
			expect(() => finalizeTrackInputSchema.parse({ durationMs: 1000, year: 1800 })).toThrow();
			expect(() => finalizeTrackInputSchema.parse({ durationMs: 1000, year: 2200 })).toThrow();
		});
	});

	describe('updateTrackInputSchema', () => {
		it('accepts partial metadata patch', () => {
			const result = updateTrackInputSchema.parse({ title: 'New Title' });
			expect(result).toEqual({ title: 'New Title' });
		});

		it('accepts setting fields to null', () => {
			const result = updateTrackInputSchema.parse({ artistNames: [], album: null });
			expect(result).toEqual({ artistNames: [], album: null });
		});

		it('accepts full metadata patch', () => {
			const result = updateTrackInputSchema.parse({
				title: 'T',
				artistNames: ['A', 'B'],
				album: 'A',
				trackNumber: null,
				genre: 'G',
				year: null,
				durationMs: 300000
			});
			expect(result).toEqual({
				title: 'T',
				artistNames: ['A', 'B'],
				album: 'A',
				trackNumber: null,
				genre: 'G',
				year: null,
				durationMs: 300000
			});
		});

		it('rejects empty title', () => {
			expect(() => updateTrackInputSchema.parse({ title: '' })).toThrow();
		});
	});

	describe('lyricsInputSchema', () => {
		it('accepts lrc text string', () => {
			const result = lyricsInputSchema.parse({ lyricsLrc: '[00:01.00]Hello world' });
			expect(result).toEqual({ lyricsLrc: '[00:01.00]Hello world' });
		});

		it('rejects empty object', () => {
			expect(() => lyricsInputSchema.parse({})).toThrow();
		});

		it('rejects empty string', () => {
			expect(() => lyricsInputSchema.parse({ lyricsLrc: '' })).toThrow();
		});
	});
});
