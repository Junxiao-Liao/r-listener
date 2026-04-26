import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from '../users/users.orm';

export const userPreferences = sqliteTable('user_preferences', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	language: text('language', { enum: ['en', 'zh'] }).notNull().default('en'),
	autoPlayNext: integer('auto_play_next', { mode: 'boolean' }).notNull().default(true),
	showMiniPlayer: integer('show_mini_player', { mode: 'boolean' }).notNull().default(true),
	preferSyncedLyrics: integer('prefer_synced_lyrics', { mode: 'boolean' }).notNull().default(true),
	defaultLibrarySort: text('default_library_sort', {
		enum: ['createdAt:desc', 'title:asc', 'artist:asc', 'album:asc']
	})
		.notNull()
		.default('createdAt:desc'),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});
