import { describe, expect, it } from 'vitest';
import { canOpenAppPathWithoutActiveTenant } from './admin-route';
import type { CurrentSessionDto } from '$shared/types/dto';

describe('canOpenAppPathWithoutActiveTenant', () => {
	it('allows platform admins into admin routes without an active tenant', () => {
		expect(canOpenAppPathWithoutActiveTenant(sessionFixture(true), '/admin')).toBe(true);
		expect(canOpenAppPathWithoutActiveTenant(sessionFixture(true), '/admin/users')).toBe(true);
	});

	it('keeps non-admin users on the tenant picker when no tenant is active', () => {
		expect(canOpenAppPathWithoutActiveTenant(sessionFixture(false), '/admin')).toBe(false);
		expect(canOpenAppPathWithoutActiveTenant(sessionFixture(false), '/library')).toBe(false);
		expect(canOpenAppPathWithoutActiveTenant(sessionFixture(false), '/tenants')).toBe(true);
	});
});

function sessionFixture(isAdmin: boolean): CurrentSessionDto {
	return {
		user: {
			id: 'usr_a',
			username: 'alice',
			isAdmin,
			isActive: true,
			lastActiveTenantId: null,
			createdAt: '2026-04-01T00:00:00.000Z'
		},
		tenants: [],
		preferences: {
			language: 'en',
			theme: 'system',
			autoPlayNext: true,
			showMiniPlayer: true,
			preferSyncedLyrics: true,
			defaultLibrarySort: 'createdAt:desc',
			updatedAt: '2026-04-01T00:00:00.000Z'
		},
		activeTenantId: null,
		sessionExpiresAt: '2026-05-01T00:00:00.000Z'
	};
}
