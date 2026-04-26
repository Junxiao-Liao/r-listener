import { describe, expect, it, vi } from 'vitest';
import type { UserDto } from '../users/users.type';
import { createPrefsService } from './prefs.service';
import type { PreferencesDto } from './prefs.type';

describe('prefs service', () => {
	it('creates default preferences lazily on get', async () => {
		const repository = {
			findByUserId: vi.fn(async () => null),
			createDefault: vi.fn(async () => prefsFixture()),
			update: vi.fn()
		};
		const service = createPrefsService(repository, {
			now: () => new Date('2026-04-26T00:00:00.000Z')
		});

		const result = await service.getPreferences('usr_a' as UserDto['id']);

		expect(result).toEqual(prefsFixture());
		expect(repository.createDefault).toHaveBeenCalledWith({
			userId: 'usr_a',
			now: new Date('2026-04-26T00:00:00.000Z')
		});
	});

	it('patches only provided editable fields', async () => {
		const repository = {
			findByUserId: vi.fn(async () => prefsFixture()),
			createDefault: vi.fn(),
			update: vi.fn(async ({ patch }) => prefsFixture(patch))
		};
		const service = createPrefsService(repository, {
			now: () => new Date('2026-04-26T00:00:00.000Z')
		});

		const result = await service.updatePreferences('usr_a' as UserDto['id'], {
			language: 'zh',
			autoPlayNext: false
		});

		expect(result.language).toBe('zh');
		expect(result.autoPlayNext).toBe(false);
		expect(result.showMiniPlayer).toBe(true);
		expect(repository.update).toHaveBeenCalledWith({
			userId: 'usr_a',
			patch: { language: 'zh', autoPlayNext: false },
			now: new Date('2026-04-26T00:00:00.000Z')
		});
	});
});

function prefsFixture(overrides: Partial<PreferencesDto> = {}): PreferencesDto {
	return {
		language: 'en',
		autoPlayNext: true,
		showMiniPlayer: true,
		preferSyncedLyrics: true,
		defaultLibrarySort: 'createdAt:desc',
		updatedAt: '2026-04-26T00:00:00.000Z' as PreferencesDto['updatedAt'],
		...overrides
	};
}
