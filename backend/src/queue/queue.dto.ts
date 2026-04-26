import { z } from 'zod';

export const addQueueItemsInputSchema = z.object({
	trackIds: z.array(z.string().min(1)).min(1),
	position: z.number().int().positive().optional()
});

export const updateQueueItemInputSchema = z.object({
	position: z.number().int().positive().optional(),
	isCurrent: z.boolean().optional()
});
