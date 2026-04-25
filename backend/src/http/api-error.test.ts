import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fieldsFromZodError, formatApiError, validationError } from './api-error';

describe('api error helpers', () => {
	it('formats uniform API error bodies', () => {
		const body = formatApiError(validationError({ email: 'Must be a valid email.' }));

		expect(body).toEqual({
			error: {
				code: 'validation_failed',
				message: 'Invalid input.',
				fields: { email: 'Must be a valid email.' }
			}
		});
	});

	it('maps zod issues to field errors', () => {
		const result = z.object({ email: z.string().email() }).safeParse({ email: 'bad' });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldsFromZodError(result.error)).toEqual({
				email: 'Invalid email address'
			});
		}
	});
});
