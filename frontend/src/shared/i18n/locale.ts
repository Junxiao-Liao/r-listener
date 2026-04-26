import { cookieName } from '$shared/paraglide/runtime';
import type { Language } from '$shared/types/dto';

const SUPPORTED: readonly Language[] = ['en', 'zh'] as const;

export function isLocale(value: unknown): value is Language {
	return typeof value === 'string' && (SUPPORTED as readonly string[]).includes(value);
}

export function parseAcceptLanguage(header: string | null | undefined): Language | null {
	if (!header) return null;
	const parts = header
		.split(',')
		.map((p) => {
			const [tag, ...rest] = p.trim().split(';');
			const q = rest
				.map((r) => r.trim())
				.find((r) => r.startsWith('q='))
				?.slice(2);
			return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q) : 1 };
		})
		.sort((a, b) => b.q - a.q);
	for (const { tag } of parts) {
		const base = tag.split('-')[0];
		if (isLocale(base)) return base;
	}
	return null;
}

export function pickLocale(
	prefs: { language?: Language | null } | null | undefined,
	acceptLanguage: string | null | undefined
): Language {
	if (prefs?.language && isLocale(prefs.language)) return prefs.language;
	return parseAcceptLanguage(acceptLanguage) ?? 'en';
}

import type { Cookies } from '@sveltejs/kit';

export function applyLocaleCookie(
	cookies: Pick<Cookies, 'set' | 'get'>,
	locale: Language
): void {
	if (cookies.get(cookieName) === locale) return;
	cookies.set(cookieName, locale, {
		path: '/',
		maxAge: 34_560_000,
		sameSite: 'lax'
	});
}
