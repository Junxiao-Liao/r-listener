// Mirrors backend DTO shapes. Kept in sync manually; do not import across packages.
// Source files: backend/src/{users,tenants,prefs,auth,http}/*.type.ts

export type Iso8601 = string;
export type Id<_Brand extends string = string> = string;

export type ApiErrorCode =
	| 'validation_failed'
	| 'unauthenticated'
	| 'invalid_credentials'
	| 'account_disabled'
	| 'admin_required'
	| 'no_active_tenant'
	| 'tenant_forbidden'
	| 'insufficient_role'
	| 'forbidden_origin'
	| 'not_found'
	| 'weak_password'
	| 'cannot_self_downgrade'
	| 'cannot_self_delete'
	| 'cannot_remove_last_owner'
	| 'rate_limited'
	| 'internal_error'
	| (string & {});

export type ApiErrorBody = {
	error: {
		code: ApiErrorCode;
		message: string;
		fields?: Record<string, string>;
	};
};

export type Language = 'en' | 'zh';
export type LibrarySort = 'createdAt:desc' | 'title:asc' | 'artist:asc' | 'album:asc';
export type TenantRole = 'owner' | 'member' | 'viewer';

export type UserDto = {
	id: Id<'user'>;
	username: string;
	isAdmin: boolean;
	isActive: boolean;
	lastActiveTenantId: Id<'tenant'> | null;
	createdAt: Iso8601;
};

export type TenantMembershipDto = {
	tenantId: Id<'tenant'>;
	tenantName: string;
	role: TenantRole;
	createdAt: Iso8601;
};

export type PreferencesDto = {
	language: Language;
	autoPlayNext: boolean;
	showMiniPlayer: boolean;
	preferSyncedLyrics: boolean;
	defaultLibrarySort: LibrarySort;
	updatedAt: Iso8601;
};

export type PreferencesPatch = Partial<
	Pick<
		PreferencesDto,
		'language' | 'autoPlayNext' | 'showMiniPlayer' | 'preferSyncedLyrics' | 'defaultLibrarySort'
	>
>;

export type CurrentSessionDto = {
	user: UserDto;
	tenants: TenantMembershipDto[];
	preferences: PreferencesDto;
	activeTenantId: Id<'tenant'> | null;
	sessionExpiresAt: Iso8601;
};

export type SigninResult = CurrentSessionDto & { sessionToken: string };

export type SwitchTenantResult = {
	user: UserDto;
	activeTenantId: Id<'tenant'>;
};
