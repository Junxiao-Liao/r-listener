import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import { toTrackDto } from '../tracks/tracks.dto';
import type { tracks } from '../tracks/tracks.orm';
import type { Id } from '../shared/shared.type';
import type { playlistTracks, playlists } from './playlists.orm';
import type { PlaylistDto, PlaylistTrackDto } from './playlists.type';

export const playlistDtoSchema = z.object({
	id: z.string(),
	tenantId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	trackCount: z.number(),
	totalDurationMs: z.number(),
	createdAt: z.string(),
	updatedAt: z.string()
});

export const playlistSortSchema = z
	.string()
	.regex(
		/^(name|createdAt|updatedAt):(asc|desc)$/,
		'Sort must be name|createdAt|updatedAt with asc|desc'
	);

export const playlistQuerySchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	sort: playlistSortSchema.optional().default('createdAt:desc'),
	q: z.string().optional()
});

export type PlaylistQuery = z.infer<typeof playlistQuerySchema>;

export const createPlaylistInputSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(2000).nullable().optional()
});

export type CreatePlaylistInput = z.infer<typeof createPlaylistInputSchema>;

export const updatePlaylistInputSchema = z
	.object({
		name: z.string().min(1).max(200).optional(),
		description: z.string().max(2000).nullable().optional()
	})
	.refine((v) => v.name !== undefined || v.description !== undefined, {
		message: 'At least one field must be provided.'
	});

export type UpdatePlaylistInput = z.infer<typeof updatePlaylistInputSchema>;

export const playlistTracksQuerySchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(200).default(100)
});

export type PlaylistTracksQuery = z.infer<typeof playlistTracksQuerySchema>;

export const addPlaylistTrackInputSchema = z.object({
	trackId: z.string().min(1),
	position: z.number().int().positive().nullable().optional()
});

export type AddPlaylistTrackInput = z.infer<typeof addPlaylistTrackInputSchema>;

export const movePlaylistTrackInputSchema = z.object({
	position: z.number().int().positive()
});

export type MovePlaylistTrackInput = z.infer<typeof movePlaylistTrackInputSchema>;

export type PlaylistRow = typeof playlists.$inferSelect;
export type PlaylistTrackRow = typeof playlistTracks.$inferSelect;
export type TrackRow = typeof tracks.$inferSelect;

export type PlaylistTrackWithTrack = {
	row: PlaylistTrackRow;
	track: TrackRow;
};

export function toPlaylistDto(
	playlist: PlaylistRow,
	trackCount: number,
	totalDurationMs: number
): PlaylistDto {
	return {
		id: playlist.id as PlaylistDto['id'],
		tenantId: playlist.tenantId as PlaylistDto['tenantId'],
		name: playlist.name,
		description: playlist.description,
		trackCount,
		totalDurationMs,
		createdAt: fromUnixTimestampSeconds(playlist.createdAt),
		updatedAt: fromUnixTimestampSeconds(playlist.updatedAt)
	};
}

export function toPlaylistTrackDto(
	input: PlaylistTrackWithTrack,
	position: number
): PlaylistTrackDto {
	return {
		playlistId: input.row.playlistId as Id<'playlist'>,
		trackId: input.row.trackId as Id<'track'>,
		position,
		addedAt: fromUnixTimestampSeconds(input.row.addedAt),
		track: toTrackDto(input.track, null)
	};
}

export function buildPlaylistTrackList(
	rows: PlaylistTrackWithTrack[]
): PlaylistTrackDto[] {
	return rows.map((r, i) => toPlaylistTrackDto(r, i + 1));
}
