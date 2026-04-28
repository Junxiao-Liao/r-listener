import { describe, expect, it } from 'vitest';
import { formatDurationMs, formatBytes } from './duration';

describe('formatDurationMs', () => {
	it('returns --:-- for null/undefined/negative/NaN', () => {
		expect(formatDurationMs(null)).toBe('--:--');
		expect(formatDurationMs(undefined)).toBe('--:--');
		expect(formatDurationMs(-1)).toBe('--:--');
		expect(formatDurationMs(NaN)).toBe('--:--');
	});

	it('renders mm:ss for under one hour', () => {
		expect(formatDurationMs(0)).toBe('0:00');
		expect(formatDurationMs(1_000)).toBe('0:01');
		expect(formatDurationMs(65_000)).toBe('1:05');
		expect(formatDurationMs(599_000)).toBe('9:59');
	});

	it('renders h:mm:ss for one hour or more', () => {
		expect(formatDurationMs(3_600_000)).toBe('1:00:00');
		expect(formatDurationMs(3_725_000)).toBe('1:02:05');
	});
});

describe('formatBytes', () => {
	it('renders bytes/KB/MB/GB with one decimal where helpful', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(2_048)).toBe('2.0 KB');
		expect(formatBytes(5_242_880)).toBe('5.0 MB');
	});
});
