import { describe, expect, it } from 'vitest';
import { detectLyricsStatus, syltFramesToLrc } from './lyrics';

describe('detectLyricsStatus', () => {
	it('returns none for null/empty/whitespace', () => {
		expect(detectLyricsStatus(null)).toBe('none');
		expect(detectLyricsStatus('')).toBe('none');
		expect(detectLyricsStatus('   \n\n  ')).toBe('none');
	});

	it('returns synced when ≥80% of non-empty lines are LRC-tagged', () => {
		const input = [
			'[00:01.00]first line',
			'[00:05.50]second line',
			'[00:10.00]third line',
			'[01:00.00]fourth line',
			'plain trailing line'
		].join('\n');
		expect(detectLyricsStatus(input)).toBe('synced');
	});

	it('returns plain when no brackets and no timestamps', () => {
		expect(detectLyricsStatus('verse one\nverse two\nchorus')).toBe('plain');
	});

	it('returns invalid when bracketed lines do not match LRC stamp format', () => {
		expect(detectLyricsStatus('[bad tag] something\nplain line')).toBe('invalid');
	});

	it('returns synced for short LRC stamps without centiseconds', () => {
		expect(detectLyricsStatus('[00:01]a\n[00:02]b\n[00:03]c')).toBe('synced');
	});

	it('treats CRLF input the same as LF', () => {
		const lrc = '[00:01.00]a\r\n[00:02.00]b\r\n';
		expect(detectLyricsStatus(lrc)).toBe('synced');
	});
});

describe('syltFramesToLrc', () => {
	it('renders [mm:ss.xx]text per frame', () => {
		const out = syltFramesToLrc([
			{ timeMs: 0, text: 'start' },
			{ timeMs: 12340, text: 'mid' },
			{ timeMs: 65432, text: 'late' }
		]);
		expect(out).toBe('[00:00.00]start\n[00:12.34]mid\n[01:05.43]late');
	});

	it('clamps negative timestamps to zero', () => {
		expect(syltFramesToLrc([{ timeMs: -100, text: 'x' }])).toBe('[00:00.00]x');
	});

	it('handles minutes >= 60 without overflowing', () => {
		expect(syltFramesToLrc([{ timeMs: 3_660_000, text: 'far' }])).toBe('[61:00.00]far');
	});
});
