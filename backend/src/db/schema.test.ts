import { describe, expect, it } from 'vitest';
import * as schema from './schema';

describe('database schema exports', () => {
	it('exports every app table through the schema barrel', () => {
		expect(Object.keys(schema).sort()).toEqual([
			'artists',
			'auditLogs',
			'memberships',
			'playbackHistory',
			'playlistTracks',
			'playlists',
			'queueItems',
			'tenants',
			'trackArtists',
			'tracks',
			'userPreferences',
			'users'
		]);
	});
});
