import { defineCustomServerStrategy } from '$shared/paraglide/runtime';
import type { Language } from '$shared/types/dto';

export const REQUEST_LOCALE_STRATEGY = 'custom-request-locale' as const;

const requestLocales = new WeakMap<Request, Language>();

let strategyRegistered = false;

export function registerRequestLocaleStrategy(): void {
	if (strategyRegistered) return;
	defineCustomServerStrategy(REQUEST_LOCALE_STRATEGY, {
		getLocale: (request?: Request) => (request ? requestLocales.get(request) : undefined)
	});
	strategyRegistered = true;
}

export function setRequestLocale(request: Request, locale: Language): void {
	requestLocales.set(request, locale);
}
