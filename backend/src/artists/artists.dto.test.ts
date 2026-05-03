import { describe, expect, it } from 'vitest';
import { artistsQuerySchema } from './artists.dto';

describe('artist DTO schemas', () => {
	describe('artistsQuerySchema', () => {
		it('defaults to empty query', () => {
			expect(artistsQuerySchema.parse({})).toEqual({});
		});

		it('parses q', () => {
			expect(artistsQuerySchema.parse({ q: 'ade' })).toEqual({ q: 'ade' });
		});

		it('strips unknown query params', () => {
			const result = artistsQuerySchema.parse({ sort: 'name:asc', cursor: 'abc', limit: '50' });
			expect(result).toEqual({});
		});
	});
});
