import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { TrackDto } from './tracks.type';
import type { tracks } from './tracks.orm';

export const trackStatusSchema = z.enum(['pending', 'ready']);
export const lyricsStatusSchema = z.enum(['none', 'synced', 'plain', 'invalid']);

export const trackDtoSchema = z.object({
	id: z.string(),
	tenantId: z.string(),
	title: z.string(),
	artist: z.string().nullable(),
	album: z.string().nullable(),
	trackNumber: z.number().nullable(),
	genre: z.string().nullable(),
	year: z.number().nullable(),
	durationMs: z.number().nullable(),
	coverUrl: z.string().nullable(),
	lyricsLrc: z.string().nullable(),
	lyricsStatus: lyricsStatusSchema,
	contentType: z.string(),
	sizeBytes: z.number(),
	status: trackStatusSchema,
	createdAt: z.string(),
	updatedAt: z.string()
});

export function toTrackDto(track: typeof tracks.$inferSelect, coverUrl: string | null): TrackDto {
	return {
		id: track.id as TrackDto['id'],
		tenantId: track.tenantId as TrackDto['tenantId'],
		title: track.title,
		artist: track.artist,
		album: track.album,
		trackNumber: track.trackNumber,
		genre: track.genre,
		year: track.year,
		durationMs: track.durationMs,
		coverUrl,
		lyricsLrc: track.lyricsLrc,
		lyricsStatus: track.lyricsStatus,
		contentType: track.contentType,
		sizeBytes: track.sizeBytes,
		status: track.status,
		createdAt: fromUnixTimestampSeconds(track.createdAt),
		updatedAt: fromUnixTimestampSeconds(track.updatedAt)
	};
}
