import { describe, expect, it } from 'vitest';
import { queryKeys } from './keys';
import { buildAdminTenantsPath, buildAdminUsersPath } from './admin.query';

describe('admin query paths', () => {
	it('uses canonical list endpoints with items/nextCursor responses', () => {
		expect(buildAdminTenantsPath({ limit: 25, cursor: 'next' })).toBe(
			'/admin/tenants?limit=25&cursor=next'
		);
		expect(buildAdminUsersPath({ q: 'ali', includeInactive: true })).toBe(
			'/admin/users?q=ali&includeInactive=true'
		);
	});

	it('does not expose audit-log read query keys', () => {
		expect(Object.keys(queryKeys)).not.toContain('adminAuditLogs');
	});
});
