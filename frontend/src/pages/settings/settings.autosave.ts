import type { Language, PreferencesDto, Theme } from '$shared/types/dto';

export const VISUAL_PREFERENCE_AUTOSAVE_ATTEMPTS = 3;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type VisualPreferencePatch =
	| { theme: Theme; language?: never }
	| { language: Language; theme?: never };

export type AutosavePreferenceParams<T> = {
	lastSaved: T;
	persist: () => Promise<T>;
	onSaved?: (value: T) => void;
	onRevert?: (value: T) => void;
	onError?: (error: unknown) => void;
	attempts?: number;
};

export type AutosavePreferenceResult<T> =
	| { ok: true; saved: T }
	| { ok: false; saved: T; error: unknown };

async function readFailureBody(response: Response): Promise<string> {
	return response.text().catch(() => '');
}

export function createPreferenceActionSaver(
	fetcher: Fetcher = globalThis.fetch.bind(globalThis),
	action = '/settings/preferences'
) {
	return async (patch: VisualPreferencePatch): Promise<PreferencesDto> => {
		const response = await fetcher(action, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(patch)
		});

		if (!response.ok) {
			const body = await readFailureBody(response);
			throw new Error(
				`Preference autosave failed with status ${response.status}${body ? `: ${body}` : ''}`
			);
		}
		return (await response.json()) as PreferencesDto;
	};
}

async function retry<T>(operation: () => Promise<T>, attempts: number): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError;
}

export async function autosavePreference<T>({
	lastSaved,
	persist,
	onSaved,
	onRevert,
	onError,
	attempts = VISUAL_PREFERENCE_AUTOSAVE_ATTEMPTS
}: AutosavePreferenceParams<T>): Promise<AutosavePreferenceResult<T>> {
	try {
		const saved = await retry(persist, attempts);
		onSaved?.(saved);
		return { ok: true, saved };
	} catch (error) {
		onRevert?.(lastSaved);
		onError?.(error);
		return { ok: false, saved: lastSaved, error };
	}
}
