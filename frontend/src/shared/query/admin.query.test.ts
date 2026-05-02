import { describe, expect, it } from 'vitest';
import { queryKeys } from './keys';
import { buildAdminTenantsPath, buildAdminTracksPath, buildAdminUsersPath } from './admin.query';

describe('admin query paths', () => {
	it('uses canonical list endpoints with items/nextCursor responses', () => {
		expect(buildAdminTenantsPath({ limit: 25, cursor: 'next', excludeUserId: 'usr_a' })).toBe(
			'/admin/tenants?limit=25&cursor=next&excludeUserId=usr_a'
		);
		expect(buildAdminUsersPath({ q: 'ali', includeInactive: true, excludeTenantId: 'tnt_a' })).toBe(
			'/admin/users?q=ali&excludeTenantId=tnt_a&includeInactive=true'
		);
		expect(buildAdminTracksPath({ limit: 50, q: 'song', tenantId: 'tnt_a' })).toBe(
			'/admin/tracks?limit=50&q=song&tenantId=tnt_a'
		);
	});

	it('keys tenant lists by params so applied filters refetch independently', () => {
		expect(queryKeys.adminTenants({ q: 'a' })).not.toEqual(queryKeys.adminTenants({ q: 'b' }));
		expect(queryKeys.adminTenants({ q: 'a' })).toEqual(['admin', 'tenants', { q: 'a' }]);
		expect(queryKeys.adminTracks({ q: 'song' })).toEqual(['admin', 'tracks', { q: 'song' }]);
	});

	it('does not expose audit-log read query keys', () => {
		expect(Object.keys(queryKeys)).not.toContain('adminAuditLogs');
	});
});
