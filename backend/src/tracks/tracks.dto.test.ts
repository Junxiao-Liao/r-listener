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
				artist: 'Artist Name',
				album: 'Album Name'
			});
			expect(result).toEqual({ title: 'My Song', artist: 'Artist Name', album: 'Album Name' });
		});

		it('accepts empty object', () => {
			expect(createTrackInputSchema.parse({})).toEqual({});
		});

		it('rejects empty strings for optional fields', () => {
			expect(() => createTrackInputSchema.parse({ title: '' })).toThrow();
			expect(() => createTrackInputSchema.parse({ artist: '' })).toThrow();
		});
	});

	describe('trackQuerySchema', () => {
		it('defaults to empty query', () => {
			const result = trackQuerySchema.parse({});
			expect(result).toEqual({
				limit: 50,
				sort: 'createdAt:desc',
				includePending: false
			});
		});

		it('parses cursor and limit', () => {
			const result = trackQuerySchema.parse({
				cursor: 'trk_018f0000-0000-7000-8000-000000000000',
				limit: '10'
			});
			expect(result.cursor).toBe('trk_018f0000-0000-7000-8000-000000000000');
			expect(result.limit).toBe(10);
		});

		it('validates sort format', () => {
			expect(() => trackQuerySchema.parse({ sort: 'invalid' })).toThrow();
			expect(() => trackQuerySchema.parse({ sort: 'title:up' })).toThrow();
			expect(trackQuerySchema.parse({ sort: 'title:asc' }).sort).toBe('title:asc');
			expect(trackQuerySchema.parse({ sort: 'artist:desc' }).sort).toBe('artist:desc');
			expect(trackQuerySchema.parse({ sort: 'album:asc' }).sort).toBe('album:asc');
			expect(trackQuerySchema.parse({ sort: 'year:desc' }).sort).toBe('year:desc');
			expect(trackQuerySchema.parse({ sort: 'durationMs:asc' }).sort).toBe('durationMs:asc');
			expect(trackQuerySchema.parse({ sort: 'createdAt:desc' }).sort).toBe('createdAt:desc');
			expect(trackQuerySchema.parse({ sort: 'updatedAt:desc' }).sort).toBe('updatedAt:desc');
		});

		it('coerces includePending', () => {
			expect(trackQuerySchema.parse({ includePending: 'true' }).includePending).toBe(true);
			expect(trackQuerySchema.parse({ includePending: 'false' }).includePending).toBe(false);
		});

		it('rejects limit above 100', () => {
			expect(() => trackQuerySchema.parse({ limit: '200' })).toThrow();
		});

		it('accepts empty q string', () => {
			const result = trackQuerySchema.parse({ q: '' });
			expect(result.limit).toBe(50);
			expect(result.sort).toBe('createdAt:desc');
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
			const result = updateTrackInputSchema.parse({ artist: null, album: null });
			expect(result).toEqual({ artist: null, album: null });
		});

		it('accepts full metadata patch', () => {
			const result = updateTrackInputSchema.parse({
				title: 'T',
				artist: null,
				album: 'A',
				trackNumber: null,
				genre: 'G',
				year: null,
				durationMs: 300000
			});
			expect(result).toEqual({
				title: 'T',
				artist: null,
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
