import { describe, expect, it, vi } from 'vitest';
import type { PreferencesDto } from '$shared/types/dto';
import {
	autosavePreference,
	createPreferenceActionSaver,
	VISUAL_PREFERENCE_AUTOSAVE_ATTEMPTS
} from './settings.autosave';

describe('createPreferenceActionSaver', () => {
	it('posts only the changed theme field', async () => {
		const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push([input, init]);
			return Response.json(prefsFixture({ theme: 'dark' }));
		});
		const save = createPreferenceActionSaver(fetcher);

		const result = await save({ theme: 'dark' });

		expect(fetcher).toHaveBeenCalledOnce();
		const [input, init] = calls[0];
		expect(input).toBe('/settings/preferences');
		expect(init?.method).toBe('PATCH');
		expect(init?.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(init?.body as string)).toEqual({ theme: 'dark' });
		expect(result).toMatchObject({ theme: 'dark' });
	});

	it('posts only the changed language field', async () => {
		const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push([input, init]);
			return Response.json(prefsFixture({ language: 'zh' }));
		});
		const save = createPreferenceActionSaver(fetcher);

		const result = await save({ language: 'zh' });

		expect(fetcher).toHaveBeenCalledOnce();
		const [, init] = calls[0];
		expect(init?.method).toBe('PATCH');
		expect(init?.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(init?.body as string)).toEqual({ language: 'zh' });
		expect(result).toMatchObject({ language: 'zh' });
	});

	it('includes failed response bodies in thrown errors', async () => {
		const save = createPreferenceActionSaver(
			vi.fn(async () =>
				Response.json(
					{
						error: {
							code: 'internal_error',
							message: 'Internal server error.',
							details: { name: 'Error', message: 'no such column: user_preferences.theme' }
						}
					},
					{ status: 500 }
				)
			)
		);

		await expect(save({ theme: 'dark' })).rejects.toThrow(
			/no such column: user_preferences\.theme/
		);
	});
});

describe('autosavePreference', () => {
	it('saves the persisted value on success', async () => {
		const persist = vi.fn(async () => 'dark');
		const onSaved = vi.fn();
		const onRevert = vi.fn();

		const result = await autosavePreference({
			lastSaved: 'system',
			persist,
			onSaved,
			onRevert
		});

		expect(result).toEqual({ ok: true, saved: 'dark' });
		expect(persist).toHaveBeenCalledOnce();
		expect(onSaved).toHaveBeenCalledWith('dark');
		expect(onRevert).not.toHaveBeenCalled();
	});

	it('retries transient failures', async () => {
		let attempts = 0;
		const persist = vi.fn(async () => {
			attempts += 1;
			if (attempts < VISUAL_PREFERENCE_AUTOSAVE_ATTEMPTS) throw new Error('temporary');
			return 'zh';
		});

		const result = await autosavePreference({
			lastSaved: 'en',
			persist
		});

		expect(result).toEqual({ ok: true, saved: 'zh' });
		expect(persist).toHaveBeenCalledTimes(VISUAL_PREFERENCE_AUTOSAVE_ATTEMPTS);
	});

	it('reverts and reports an error after final failure', async () => {
		const error = new Error('still failing');
		const persist = vi.fn(async () => {
			throw error;
		});
		const onRevert = vi.fn();
		const onError = vi.fn();

		const result = await autosavePreference({
			lastSaved: 'light',
			persist,
			onRevert,
			onError
		});

		expect(result).toEqual({ ok: false, saved: 'light', error });
		expect(persist).toHaveBeenCalledTimes(VISUAL_PREFERENCE_AUTOSAVE_ATTEMPTS);
		expect(onRevert).toHaveBeenCalledWith('light');
		expect(onError).toHaveBeenCalledWith(error);
	});
});

function prefsFixture(overrides: Partial<PreferencesDto> = {}): PreferencesDto {
	return {
		language: 'en',
		theme: 'system',
		autoPlayNext: true,
		showMiniPlayer: true,
		preferSyncedLyrics: true,
		defaultLibrarySort: 'createdAt:desc',
		updatedAt: '2026-04-26T00:00:00.000Z',
		...overrides
	};
}
