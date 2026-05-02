import { z } from 'zod';

export const adminTrackListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(200).default(50),
	cursor: z.string().optional(),
	q: z.string().optional(),
	tenantId: z.string().optional()
});

export const adminHardDeleteTracksSchema = z.object({
	trackIds: z.array(z.string()).min(1).max(50)
});

