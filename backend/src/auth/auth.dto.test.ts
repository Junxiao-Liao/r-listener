import { describe, expect, it } from 'vitest';
import { signinInputSchema } from './auth.dto';

describe('signin input schema', () => {
	it('uses canonical username as the login identifier', () => {
		expect(
			signinInputSchema.parse({
				username: '  Alice-01  ',
				password: 'secret'
			})
		).toEqual({
			username: 'alice-01',
			password: 'secret'
		});
	});

	it('rejects old email login payloads', () => {
		const result = signinInputSchema.safeParse({
			email: 'alice@example.com',
			password: 'secret'
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.join('.') === 'username')).toBe(true);
		}
	});
});
