import { z } from 'zod';

export const playbackEventInputSchema = z.object({
	trackId: z.string().min(1),
	startedAt: z.iso.datetime(),
	positionMs: z.number().int().nonnegative(),
	event: z.enum(['play', 'progress', 'ended']),
	playlistId: z.string().min(1).nullable()
});
