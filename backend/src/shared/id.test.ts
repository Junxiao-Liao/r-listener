import { describe, expect, it } from 'vitest';
import { createId, isPrefixedUuidV7 } from './id';

describe('id helpers', () => {
	it('creates prefixed UUIDv7 ids', () => {
		const id = createId('usr_');

		expect(id.startsWith('usr_')).toBe(true);
		expect(isPrefixedUuidV7(id, 'usr_')).toBe(true);
	});

	it('rejects wrong prefixes or UUID versions', () => {
		expect(isPrefixedUuidV7('tnt_018f0000-0000-7000-8000-000000000000', 'usr_')).toBe(false);
		expect(isPrefixedUuidV7('usr_018f0000-0000-4000-8000-000000000000', 'usr_')).toBe(false);
	});
});
