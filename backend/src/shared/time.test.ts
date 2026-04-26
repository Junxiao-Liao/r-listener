import { describe, expect, it } from 'vitest';
import { fromUnixSecondsToDate, fromUnixTimestampSeconds, toUnixTimestampSeconds } from './time';

describe('time helpers', () => {
	it('converts between D1 unix seconds and ISO strings', () => {
		expect(fromUnixTimestampSeconds(1_777_161_600)).toBe('2026-04-26T00:00:00.000Z');
		expect(toUnixTimestampSeconds(new Date('2026-04-26T00:00:00.999Z'))).toBe(1_777_161_600);
		expect(fromUnixSecondsToDate(1_777_161_600).toISOString()).toBe('2026-04-26T00:00:00.000Z');
	});
});
