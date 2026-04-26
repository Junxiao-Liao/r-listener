import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { PlaylistDto } from './playlists.type';
import type { playlists } from './playlists.orm';

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

export function toPlaylistDto(
	playlist: typeof playlists.$inferSelect,
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
