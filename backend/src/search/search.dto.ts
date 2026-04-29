import { z } from 'zod';
import type { SearchKind } from './search.type';

export const searchKindSchema = z.enum(['track', 'playlist']);

const searchKindsSchema = z
	.string()
	.transform((value) => value.split(',').map((v) => v.trim()).filter(Boolean))
	.pipe(z.array(searchKindSchema).min(1))
	.optional()
	.transform((value) => value ?? (['track', 'playlist'] satisfies SearchKind[]));

export const searchQuerySchema = z.object({
	q: z.string().trim().min(1),
	limit: z.coerce.number().int().positive().max(50).default(20),
	cursor: z.string().optional(),
	kinds: searchKindsSchema
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
