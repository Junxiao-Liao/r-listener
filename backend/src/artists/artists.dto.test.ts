import { describe, expect, it } from 'vitest';
import { artistSortSchema, artistsQuerySchema } from './artists.dto';

describe('artist DTO schemas', () => {
	describe('artistsQuerySchema', () => {
		it('defaults pagination and sort options', () => {
			expect(artistsQuerySchema.parse({})).toEqual({ limit: 25, sort: 'name:asc' });
		});

		it('parses cursor, q, limit, and sort', () => {
			expect(artistsQuerySchema.parse({ q: 'ade', cursor: 'abc', limit: '10', sort: 'name:desc' })).toEqual({
				q: 'ade',
				cursor: 'abc',
				limit: 10,
				sort: 'name:desc'
			});
		});

		it('rejects invalid limits', () => {
			expect(() => artistsQuerySchema.parse({ limit: '0' })).toThrow();
			expect(() => artistsQuerySchema.parse({ limit: '101' })).toThrow();
		});

		it('rejects invalid sort values', () => {
			expect(() => artistsQuerySchema.parse({ sort: 'createdAt:desc' })).toThrow();
			expect(() => artistsQuerySchema.parse({ sort: 'invalid' })).toThrow();
		});
	});

	describe('artistSortSchema', () => {
		it('accepts valid sort values', () => {
			expect(artistSortSchema.parse('name:asc')).toBe('name:asc');
			expect(artistSortSchema.parse('name:desc')).toBe('name:desc');
		});

		it('rejects invalid sort values', () => {
			expect(() => artistSortSchema.parse('name:up')).toThrow();
			expect(() => artistSortSchema.parse('title:asc')).toThrow();
		});
	});
});
