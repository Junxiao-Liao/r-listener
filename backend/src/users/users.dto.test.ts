import { describe, expect, it } from 'vitest';
import { userDtoSchema, usernameSchema, toUserDto } from './users.dto';
import type { users } from './users.orm';

describe('username schema', () => {
	it.each([
		['Alice_01', 'alice_01'],
		['  mixed-Case9  ', 'mixed-case9'],
		['abc', 'abc']
	])('canonicalizes accepted usernames', (input, expected) => {
		expect(usernameSchema.parse(input)).toBe(expected);
	});

	it.each(['ab', 'a'.repeat(33), 'user@example.com', 'user.name', 'white space', ''])(
		'rejects invalid username %s',
		(input) => {
			expect(usernameSchema.safeParse(input).success).toBe(false);
		}
	);
});

describe('user dto', () => {
	it('serializes username as the only public user label', () => {
		const dto = toUserDto({
			id: 'usr_018f0000-0000-7000-8000-000000000000',
			username: 'alice',
			passwordHash: 'hash',
			isAdmin: false,
			isActive: true,
			lastActiveTenantId: null,
			createdAt: new Date('2026-04-01T00:00:00.000Z'),
			updatedAt: new Date('2026-04-01T00:00:00.000Z'),
			deletedAt: null
		} satisfies typeof users.$inferSelect);

		expect(userDtoSchema.parse(dto)).toEqual({
			id: 'usr_018f0000-0000-7000-8000-000000000000',
			username: 'alice',
			isAdmin: false,
			isActive: true,
			lastActiveTenantId: null,
			createdAt: '2026-04-01T00:00:00.000Z'
		});
		expect(dto).not.toHaveProperty('email');
		expect(dto).not.toHaveProperty('displayName');
	});
});
