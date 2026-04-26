import { z } from 'zod';

export const adminListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(200).default(50),
	cursor: z.string().optional(),
	q: z.string().optional()
});
