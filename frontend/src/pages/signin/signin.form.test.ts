import { describe, expect, it } from 'vitest';
import { signinSchema } from './signin.form';

describe('signinSchema', () => {
	it('rejects empty username and password', () => {
		const r = signinSchema.safeParse({ username: '', password: '' });
		expect(r.success).toBe(false);
	});

	it('accepts trimmed username + non-empty password', () => {
		const r = signinSchema.safeParse({ username: '  alice  ', password: 'pw' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.username).toBe('alice');
	});
});
