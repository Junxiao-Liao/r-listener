export const queryKeys = {
	session: ['session'] as const,
	adminTenants: (params: Record<string, unknown> = {}) => ['admin', 'tenants', params] as const,
	adminUsers: (params: Record<string, unknown> = {}) => ['admin', 'users', params] as const,
	adminUser: (id: string) => ['admin', 'users', id] as const,
	adminTenant: (id: string) => ['admin', 'tenants', id] as const,
	adminTenantMembers: (id: string) => ['admin', 'tenants', id, 'members'] as const,
	tracks: ['tracks'] as const,
	tracksList: (params: { sort: string; q?: string; includePending: boolean }) =>
		['tracks', 'list', params] as const,
	track: (id: string) => ['tracks', 'detail', id] as const,
	artists: ['artists'] as const,
	artistsList: (params: { q?: string; limit: number }) =>
		['artists', 'list', params] as const,
	artistDetail: (id: string) => ['artists', 'detail', id] as const,
	artistTracks: (id: string) => ['artists', 'detail', id, 'tracks'] as const,
	queue: ['queue'] as const,
	recentTracks: ['playback', 'recent'] as const,
	continueListening: ['playback', 'continue'] as const,
	playlists: ['playlists'] as const,
	playlistsList: (params: { sort: string; q?: string }) =>
		['playlists', 'list', params] as const,
	playlist: (id: string) => ['playlists', 'detail', id] as const,
	playlistTracks: (id: string) => ['playlists', 'detail', id, 'tracks'] as const,
};
