import { describe, expect, it } from 'vitest';
import { isLocale, parseAcceptLanguage, pickLocale } from './locale';

describe('isLocale', () => {
	it('accepts en and zh', () => {
		expect(isLocale('en')).toBe(true);
		expect(isLocale('zh')).toBe(true);
	});
	it('rejects others', () => {
		expect(isLocale('ja')).toBe(false);
		expect(isLocale('')).toBe(false);
		expect(isLocale(null)).toBe(false);
	});
});

describe('parseAcceptLanguage', () => {
	it('returns the highest-priority supported locale', () => {
		expect(parseAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh');
		expect(parseAcceptLanguage('en-US,en;q=0.9,fr;q=0.8')).toBe('en');
	});
	it('returns null when no supported locale matches', () => {
		expect(parseAcceptLanguage('fr,de;q=0.9')).toBe(null);
	});
});

describe('pickLocale', () => {
	it('prefers the user preference when present', () => {
		expect(pickLocale({ language: 'zh' }, 'en-US,en')).toBe('zh');
	});
	it('falls back to Accept-Language when no preference is given', () => {
		expect(pickLocale(null, 'zh-CN,zh;q=0.9')).toBe('zh');
	});
	it('ignores invalid preferences and uses Accept-Language', () => {
		expect(pickLocale({ language: 'fr' as never }, 'zh-CN,zh;q=0.9')).toBe('zh');
	});
	it('defaults to en when nothing matches', () => {
		expect(pickLocale(null, 'fr')).toBe('en');
		expect(pickLocale(null, null)).toBe('en');
	});
});
