import { describe, expect, it } from 'vitest';
import { parseTheme, parseThemeCookie, resolveTheme, THEME_COOKIE } from './theme';

describe('theme helpers', () => {
	it('parses supported theme values', () => {
		expect(parseTheme('system')).toBe('system');
		expect(parseTheme('light')).toBe('light');
		expect(parseTheme('dark')).toBe('dark');
	});

	it('falls back to system for unsupported theme values', () => {
		expect(parseTheme('sepia')).toBe('system');
		expect(parseTheme(undefined)).toBe('system');
	});

	it('reads the theme cookie from a cookie header', () => {
		expect(parseThemeCookie(`session=abc; ${THEME_COOKIE}=dark; locale=en`)).toBe('dark');
	});

	it('resolves system theme from the current media preference', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
		expect(resolveTheme('light', true)).toBe('light');
	});
});
