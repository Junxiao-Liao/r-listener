export const queryKeys = {
	session: ['session'] as const,
	adminTenants: ['admin', 'tenants'] as const,
	tracks: ['tracks'] as const,
	tracksList: (params: { sort: string; q?: string; includePending: boolean }) =>
		['tracks', 'list', params] as const,
	track: (id: string) => ['tracks', 'detail', id] as const
};
