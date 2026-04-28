import { z } from 'zod';

export const trackMetadataSchema = z.object({
	title: z.string().trim().min(1, 'Title is required.'),
	artist: z.string().trim().optional(),
	album: z.string().trim().optional(),
	trackNumber: z
		.string()
		.optional()
		.transform((v) => (v && v.trim().length > 0 ? Number(v) : null))
		.refine(
			(v) => v === null || (Number.isInteger(v) && v > 0),
			'Track number must be a positive integer.'
		),
	genre: z.string().trim().optional(),
	year: z
		.string()
		.optional()
		.transform((v) => (v && v.trim().length > 0 ? Number(v) : null))
		.refine(
			(v) => v === null || (Number.isInteger(v) && v >= 1900 && v <= 2100),
			'Year must be between 1900 and 2100.'
		),
	durationMs: z
		.string()
		.optional()
		.transform((v) => (v && v.trim().length > 0 ? Number(v) : null))
		.refine(
			(v) => v === null || (Number.isInteger(v) && v > 0),
			'Duration must be a positive integer (ms).'
		)
});

export type TrackMetadataForm = z.infer<typeof trackMetadataSchema>;
