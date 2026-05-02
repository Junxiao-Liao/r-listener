import type { Id } from '../shared/shared.type';
import type { TrackDto } from '../tracks/tracks.type';
import type { AdminListResponse } from './admin.type';

export type AdminTrackListItemDto = TrackDto & {
	tenantName: string;
	tenantDeleted: boolean;
	isDeleted: boolean;
	audioR2Key: string;
};

export type AdminTrackListQuery = {
	limit: number;
	cursor?: string | undefined;
	q?: string | undefined;
	tenantId?: Id<'tenant'> | undefined;
};

export type AdminTrackListResponse = AdminListResponse<AdminTrackListItemDto>;

export type AdminTrackDeleteCandidate = {
	id: Id<'track'>;
	tenantId: Id<'tenant'>;
	audioR2Key: string;
	sizeBytes: number;
};

export type AdminHardDeleteTracksInput = {
	trackIds: Id<'track'>[];
};

export type AdminHardDeleteTracksResult = {
	deletedCount: number;
	freedBytes: number;
	r2KeysDeleted: number;
	r2KeysRetained: number;
};

