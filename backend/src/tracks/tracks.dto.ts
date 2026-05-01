import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import { artistDtoSchema } from '../artists/artists.dto';
import type { TrackDto } from './tracks.type';
import type { tracks } from './tracks.orm';
import type { ArtistDto } from '../artists/artists.type';

export const trackStatusSchema = z.enum(['pending', 'ready']);
export const lyricsStatusSchema = z.enum(['none', 'synced', 'plain', 'invalid']);

export const trackDtoSchema = z.object({
	id: z.string(),
	tenantId: z.string(),
	title: z.string(),
	artists: z.array(artistDtoSchema),
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

export const createTrackInputSchema = z.object({
	title: z.string().min(1).optional(),
	artistNames: z.array(z.string().trim().min(1)).optional().default([]),
	album: z.string().min(1).optional()
});

export type CreateTrackInput = z.infer<typeof createTrackInputSchema>;

export const trackSortSchema = z
	.string()
	.regex(
		/^(title|album|year|durationMs|createdAt|updatedAt):(asc|desc)$/,
		'Sort must be field:asc or field:desc'
	);

export const trackQuerySchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	sort: trackSortSchema.optional().default('createdAt:desc'),
	q: z.string().optional(),
	includePending: z
		.preprocess(
			(v) => (v === 'true' ? true : v === 'false' ? false : v),
			z.boolean().default(false)
		)
});

export type TrackQuery = z.infer<typeof trackQuerySchema>;

export const finalizeTrackInputSchema = z.object({
	durationMs: z.number().int().positive().max(21600000),
	lyricsLrc: z.string().optional(),
	trackNumber: z.number().int().positive().optional(),
	genre: z.string().min(1).optional(),
	year: z.number().int().min(1900).max(2100).optional()
});

export type FinalizeTrackInput = z.infer<typeof finalizeTrackInputSchema>;

export const updateTrackInputSchema = z.object({
	title: z.string().min(1).optional(),
	artistNames: z.array(z.string().trim().min(1)).optional(),
	album: z.string().nullable().optional(),
	trackNumber: z.number().int().positive().nullable().optional(),
	genre: z.string().nullable().optional(),
	year: z.number().int().min(1900).max(2100).nullable().optional(),
	durationMs: z.number().int().positive().max(21600000).nullable().optional()
});

export type UpdateTrackInput = z.infer<typeof updateTrackInputSchema>;

export const lyricsInputSchema = z.object({
	lyricsLrc: z.string().min(1)
});

export type LyricsInput = z.infer<typeof lyricsInputSchema>;

export function toTrackDto(
	track: typeof tracks.$inferSelect,
	coverUrl: string | null,
	artists: ArtistDto[] = []
): TrackDto {
	return {
		id: track.id as TrackDto['id'],
		tenantId: track.tenantId as TrackDto['tenantId'],
		title: track.title,
		artists,
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
