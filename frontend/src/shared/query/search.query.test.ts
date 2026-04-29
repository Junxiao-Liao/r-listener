import { describe, expect, it } from 'vitest';
import { buildSearchPath } from './search.query';

describe('buildSearchPath', () => {
	it('trims q and includes limit', () => {
		expect(buildSearchPath({ q: '  sun  ', limit: 5 })).toBe('/search?q=sun&limit=5');
	});

	it('serializes requested kinds', () => {
		expect(buildSearchPath({ q: 'mix', kinds: ['track', 'playlist'] })).toBe(
			'/search?q=mix&limit=20&kinds=track%2Cplaylist'
		);
	});
});
