import type { PrefsRepository } from './prefs.repository';
import type { PreferencesDto, PreferencesPatch } from './prefs.type';
import type { UserId } from '../users/users.type';

export type PrefsService = {
	getPreferences(userId: UserId): Promise<PreferencesDto>;
	updatePreferences(userId: UserId, patch: PreferencesPatch): Promise<PreferencesDto>;
};

export type PrefsServiceOptions = {
	now?: () => Date;
};

export function createPrefsService(
	prefsRepository: PrefsRepository,
	options: PrefsServiceOptions = {}
): PrefsService {
	const now = options.now ?? (() => new Date());
	return {
		getPreferences: async (userId) => {
			const existing = await prefsRepository.findByUserId(userId);
			return existing ?? prefsRepository.createDefault({ userId, now: now() });
		},
		updatePreferences: async (userId, patch) => {
			const existing = await prefsRepository.findByUserId(userId);
			if (!existing) {
				await prefsRepository.createDefault({ userId, now: now() });
			}
			return prefsRepository.update({ userId, patch, now: now() });
		}
	};
}
