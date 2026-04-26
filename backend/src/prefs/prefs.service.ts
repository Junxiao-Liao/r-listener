import type { PrefsRepository } from './prefs.repository';

export type PrefsService = {
	readonly prefsRepository: PrefsRepository;
};

export function createPrefsService(prefsRepository: PrefsRepository): PrefsService {
	return { prefsRepository };
}
