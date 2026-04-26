import { z } from 'zod';

export const searchQuerySchema = z.object({
	q: z.string().min(1),
	limit: z.coerce.number().int().positive().max(200).default(50),
	cursor: z.string().optional()
});
