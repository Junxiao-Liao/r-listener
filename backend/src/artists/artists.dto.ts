import { z } from 'zod';
import type { artists } from './artists.orm';
import type { ArtistAggregateDto, ArtistDto } from './artists.type';

export const artistDtoSchema = z.object({
	id: z.string(),
	name: z.string()
});

export const artistAggregateDtoSchema = artistDtoSchema.extend({
	trackCount: z.number(),
	totalDurationMs: z.number()
});

export const artistsQuerySchema = z.object({
	q: z.string().optional()
});

export type ArtistsQuery = z.infer<typeof artistsQuerySchema>;

export function toArtistDto(row: typeof artists.$inferSelect): ArtistDto {
	return {
		id: row.id as ArtistDto['id'],
		name: row.name
	};
}

export function toArtistAggregateDto(
	row: typeof artists.$inferSelect,
	agg: { trackCount: number; totalDurationMs: number }
): ArtistAggregateDto {
	return {
		...toArtistDto(row),
		trackCount: agg.trackCount,
		totalDurationMs: agg.totalDurationMs
	};
}
