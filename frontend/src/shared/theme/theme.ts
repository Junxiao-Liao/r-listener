import type { Cookies } from '@sveltejs/kit';
import type { Theme } from '$shared/types/dto';

export const THEME_COOKIE = 'theme';

const THEMES: readonly Theme[] = ['system', 'light', 'dark'] as const;

export function isTheme(value: unknown): value is Theme {
	return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export function parseTheme(value: unknown): Theme {
	return isTheme(value) ? value : 'system';
}

export function parseThemeCookie(cookieHeader: string | null | undefined): Theme {
	if (!cookieHeader) return 'system';
	const value = cookieHeader
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${THEME_COOKIE}=`))
		?.slice(THEME_COOKIE.length + 1);
	if (!value) return 'system';
	try {
		return parseTheme(decodeURIComponent(value));
	} catch {
		return 'system';
	}
}

export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
	if (theme === 'system') return prefersDark ? 'dark' : 'light';
	return theme;
}

export function applyTheme(theme: unknown): void {
	if (typeof document === 'undefined') return;
	const parsed = parseTheme(theme);
	const prefersDark =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
	const resolved = resolveTheme(parsed, prefersDark);
	document.documentElement.classList.toggle('dark', resolved === 'dark');
	document.documentElement.style.colorScheme = resolved;
}

export function applyThemeFromCookie(): void {
	if (typeof document === 'undefined') return;
	applyTheme(parseThemeCookie(document.cookie));
}

export function applyThemeCookie(
	cookies: Pick<Cookies, 'get' | 'set'>,
	theme: Theme
): void {
	if (cookies.get(THEME_COOKIE) === theme) return;
	cookies.set(THEME_COOKIE, theme, {
		path: '/',
		maxAge: 34_560_000,
		sameSite: 'lax'
	});
}
