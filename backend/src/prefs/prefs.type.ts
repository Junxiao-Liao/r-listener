import type { Iso8601 } from '../shared/shared.type';

export type Language = 'en' | 'zh';
export type LibrarySort = 'createdAt:desc' | 'title:asc' | 'artist:asc' | 'album:asc';

export type PreferencesDto = {
	language: Language;
	autoPlayNext: boolean;
	showMiniPlayer: boolean;
	preferSyncedLyrics: boolean;
	defaultLibrarySort: LibrarySort;
	updatedAt: Iso8601;
};
