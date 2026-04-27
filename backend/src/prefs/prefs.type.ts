import type { Iso8601 } from '../shared/shared.type';

export type Language = 'en' | 'zh';
export type LibrarySort = 'createdAt:desc' | 'title:asc' | 'artist:asc' | 'album:asc';
export type Theme = 'system' | 'light' | 'dark';

export type PreferencesDto = {
	language: Language;
	theme: Theme;
	autoPlayNext: boolean;
	showMiniPlayer: boolean;
	preferSyncedLyrics: boolean;
	defaultLibrarySort: LibrarySort;
	updatedAt: Iso8601;
};

export type PreferencesPatch = Partial<
	Pick<
		PreferencesDto,
		| 'language'
		| 'theme'
		| 'autoPlayNext'
		| 'showMiniPlayer'
		| 'preferSyncedLyrics'
		| 'defaultLibrarySort'
	>
>;
