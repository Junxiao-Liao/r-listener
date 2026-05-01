import { describe, expect, it } from 'vitest';
import { artistsQuerySchema } from './artists.dto';

describe('artist DTO schemas', () => {
	describe('artistsQuerySchema', () => {
		it('defaults pagination options', () => {
			expect(artistsQuerySchema.parse({})).toEqual({ limit: 25 });
		});

		it('parses cursor, q, and limit', () => {
			expect(artistsQuerySchema.parse({ q: 'ade', cursor: 'abc', limit: '10' })).toEqual({
				q: 'ade',
				cursor: 'abc',
				limit: 10
			});
		});

		it('rejects invalid limits', () => {
			expect(() => artistsQuerySchema.parse({ limit: '0' })).toThrow();
			expect(() => artistsQuerySchema.parse({ limit: '101' })).toThrow();
		});
	});
});
