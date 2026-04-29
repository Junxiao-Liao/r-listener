export const queryKeys = {
	session: ['session'] as const,
	adminTenants: ['admin', 'tenants'] as const,
	tracks: ['tracks'] as const,
	tracksList: (params: { sort: string; q?: string; includePending: boolean }) =>
		['tracks', 'list', params] as const,
	track: (id: string) => ['tracks', 'detail', id] as const,
	queue: ['queue'] as const,
	recentTracks: ['playback', 'recent'] as const,
	continueListening: ['playback', 'continue'] as const,
	playlists: ['playlists'] as const,
	playlistsList: (params: { sort: string; q?: string }) =>
		['playlists', 'list', params] as const,
	playlist: (id: string) => ['playlists', 'detail', id] as const,
	playlistTracks: (id: string) => ['playlists', 'detail', id, 'tracks'] as const,
	search: (params: { q: string; limit: number; kinds?: string }) =>
		['search', params] as const
};
