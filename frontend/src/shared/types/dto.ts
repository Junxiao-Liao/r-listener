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
		details?: {
			name: string;
			message: string;
			stack?: string;
			cause?: string;
		};
	};
};

export type Language = 'en' | 'zh';
export type LibrarySort = 'createdAt:desc' | 'title:asc' | 'album:asc';
export type Theme = 'system' | 'light' | 'dark';
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

export type TenantDto = {
	id: Id<'tenant'>;
	name: string;
	createdAt: Iso8601;
};

export type PreferencesDto = {
	language: Language;
	theme: Theme;
	autoPlayNext: boolean;
	showMiniPlayer: boolean;
	preferSyncedLyrics: boolean;
	defaultLibrarySort: LibrarySort;
	updatedAt: Iso8601;
};

export type PreferencesPatch = Partial<
	Pick<
		PreferencesDto,
		| 'language'
		| 'theme'
		| 'autoPlayNext'
		| 'showMiniPlayer'
		| 'preferSyncedLyrics'
		| 'defaultLibrarySort'
	>
>;

export type CurrentSessionDto = {
	user: UserDto;
	tenants: TenantMembershipDto[];
	preferences: PreferencesDto;
	activeTenantId: Id<'tenant'> | null;
	sessionExpiresAt: Iso8601;
};

export type SwitchTenantResult = {
	user: UserDto;
	activeTenantId: Id<'tenant'>;
};

export type AdminTenantListItemDto = {
	id: Id<'tenant'>;
	name: string;
	createdAt: Iso8601;
	memberCount: number;
	trackCount: number;
};

export type AdminUserListItemDto = UserDto & {
	workspaceCount: number;
};

export type AdminUserDetailDto = UserDto & {
	memberships: TenantMembershipDto[];
};

export type AdminTenantMemberDto = TenantMembershipDto & {
	user: UserDto;
};

export type ListResponse<T> = {
	items: T[];
	nextCursor: string | null;
};

export type AdminCreateUserInput = {
	username: string;
	password: string;
	isAdmin: boolean;
	initialMembership?: { tenantId: Id<'tenant'>; role: TenantRole };
};

export type AdminUpdateUserInput = {
	username?: string;
	isAdmin?: boolean;
	isActive?: boolean;
};

export type AdminCreateTenantInput = {
	name: string;
	ownerUserId: Id<'user'>;
};

export type AdminUpdateTenantInput = {
	name: string;
};

export type TrackStatus = 'pending' | 'ready';
export type LyricsStatus = 'none' | 'synced' | 'plain' | 'invalid';

export type TrackSortField =
	| 'title'
	| 'album'
	| 'year'
	| 'durationMs'
	| 'createdAt'
	| 'updatedAt';
export type TrackSortDirection = 'asc' | 'desc';
export type TrackSort = `${TrackSortField}:${TrackSortDirection}`;

export type ArtistDto = {
	id: Id<'artist'>;
	name: string;
};

export type TrackDto = {
	id: Id<'track'>;
	tenantId: Id<'tenant'>;
	title: string;
	artists: ArtistDto[];
	album: string | null;
	trackNumber: number | null;
	genre: string | null;
	year: number | null;
	durationMs: number | null;
	coverUrl: string | null;
	lyricsLrc: string | null;
	lyricsStatus: LyricsStatus;
	contentType: string;
	sizeBytes: number;
	status: TrackStatus;
	createdAt: Iso8601;
	updatedAt: Iso8601;
};

export type TrackListResponse = {
	items: TrackDto[];
	nextCursor: string | null;
};

export type TrackPatch = {
	title?: string;
	artistNames?: string[];
	album?: string | null;
	trackNumber?: number | null;
	genre?: string | null;
	year?: number | null;
	durationMs?: number | null;
};

export type FinalizeTrackInput = {
	durationMs: number;
	lyricsLrc?: string;
	trackNumber?: number;
	genre?: string;
	year?: number;
};

// Queue --------------------------------------------------------------
export type QueueItemDto = {
	id: Id<'queue_item'>;
	tenantId: Id<'tenant'>;
	userId: Id<'user'>;
	trackId: Id<'track'>;
	position: number;
	isCurrent: boolean;
	addedAt: Iso8601;
	updatedAt: Iso8601;
	track: TrackDto;
};

export type QueueStateDto = {
	items: QueueItemDto[];
	currentItemId: Id<'queue_item'> | null;
	updatedAt: Iso8601 | null;
};

// Playback -----------------------------------------------------------
export type PlaybackEventKind = 'play' | 'progress' | 'ended';

export type PlaybackEventInput = {
	trackId: Id<'track'>;
	startedAt: Iso8601;
	positionMs: number;
	event: PlaybackEventKind;
	playlistId: Id<'playlist'> | null;
};

export type RecentTrackDto = {
	track: TrackDto;
	lastPlayedAt: Iso8601;
	lastPositionMs: number;
	playlistId: Id<'playlist'> | null;
};

export type RecentTracksResponse = {
	items: RecentTrackDto[];
	nextCursor: string | null;
};

// Playlists ----------------------------------------------------------
export type PlaylistDto = {
	id: Id<'playlist'>;
	tenantId: Id<'tenant'>;
	name: string;
	description: string | null;
	trackCount: number;
	totalDurationMs: number;
	createdAt: Iso8601;
	updatedAt: Iso8601;
};

export type PlaylistTrackDto = {
	playlistId: Id<'playlist'>;
	trackId: Id<'track'>;
	position: number;
	addedAt: Iso8601;
	track: TrackDto;
};

export type PlaylistListResponse = {
	items: PlaylistDto[];
	nextCursor: string | null;
};

export type PlaylistTrackListResponse = {
	items: PlaylistTrackDto[];
	nextCursor: string | null;
};

export type PlaylistSortField = 'name' | 'createdAt' | 'updatedAt';
export type PlaylistSort = `${PlaylistSortField}:${'asc' | 'desc'}`;

export type CreatePlaylistInput = {
	name: string;
	description?: string | null;
};

export type UpdatePlaylistInput = {
	name?: string;
	description?: string | null;
};

export type AddPlaylistTrackInput = {
	trackId: Id<'track'>;
	position?: number | null;
};

// Search -------------------------------------------------------------
export type SearchKind = 'track' | 'playlist';

export type SearchHitDto =
	| { kind: 'track'; track: TrackDto }
	| { kind: 'playlist'; playlist: PlaylistDto };

export type SearchResponse = {
	items: SearchHitDto[];
	nextCursor: string | null;
};
