import { z } from 'zod';
import type { artists } from './artists.orm';
import type { ArtistDto } from './artists.type';

export const artistDtoSchema = z.object({
	id: z.string(),
	name: z.string()
});

export const artistsQuerySchema = z.object({
	q: z.string().optional(),
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25)
});

export type ArtistsQuery = z.infer<typeof artistsQuerySchema>;

export function toArtistDto(row: typeof artists.$inferSelect): ArtistDto {
	return {
		id: row.id as ArtistDto['id'],
		name: row.name
	};
}
