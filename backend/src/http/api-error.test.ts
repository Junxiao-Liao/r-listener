import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiError, fieldsFromZodError, formatApiError, validationError } from './api-error';

describe('api error helpers', () => {
	it('formats uniform API error bodies', () => {
		const body = formatApiError(validationError({ username: 'Username is required.' }));

		expect(body).toEqual({
			error: {
				code: 'validation_failed',
				message: 'Invalid input.',
				fields: { username: 'Username is required.' }
			}
		});
	});

	it('maps zod issues to field errors', () => {
		const result = z.object({ username: z.string().min(3) }).safeParse({ username: 'ab' });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldsFromZodError(result.error)).toEqual({
				username: 'Too small: expected string to have >=3 characters'
			});
		}
	});

	it('supports username conflict errors', () => {
		expect(formatApiError(apiError(409, 'username_conflict', 'Username is already in use.'))).toEqual({
			error: {
				code: 'username_conflict',
				message: 'Username is already in use.'
			}
		});
	});
});
