import { describe, expect, it } from 'vitest';
import { makeCoverPlaceholder } from './cover';

describe('makeCoverPlaceholder', () => {
	it('returns the same hue for the same case-insensitive seed', () => {
		const a = makeCoverPlaceholder('Hello World');
		const b = makeCoverPlaceholder('hello world');
		expect(a.bg).toBe(b.bg);
	});

	it('returns different hues for different seeds', () => {
		const a = makeCoverPlaceholder('alpha');
		const b = makeCoverPlaceholder('omega');
		expect(a.bg).not.toBe(b.bg);
	});

	it('uses the first character of the trimmed seed in upper case', () => {
		expect(makeCoverPlaceholder('  apple ').letter).toBe('A');
		expect(makeCoverPlaceholder('zebra').letter).toBe('Z');
	});

	it('falls back to ? when the seed is empty', () => {
		expect(makeCoverPlaceholder('').letter).toBe('?');
		expect(makeCoverPlaceholder('   ').letter).toBe('?');
	});

	it('produces an hsl() string with hue in [0, 360)', () => {
		const out = makeCoverPlaceholder('whatever');
		const match = /^hsl\((\d+) /.exec(out.bg);
		expect(match).not.toBeNull();
		const hue = Number(match![1]);
		expect(hue).toBeGreaterThanOrEqual(0);
		expect(hue).toBeLessThan(360);
	});
});
