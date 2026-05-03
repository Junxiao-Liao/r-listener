import { describe, expect, it } from 'vitest';
import { activeTimeMs, detectLyricsStatus, parseSyncedLrc, syltFramesToLrc } from './lyrics';

describe('detectLyricsStatus', () => {
	it('returns none for null/empty/whitespace', () => {
		expect(detectLyricsStatus(null)).toBe('none');
		expect(detectLyricsStatus('')).toBe('none');
		expect(detectLyricsStatus('   \n\n  ')).toBe('none');
	});

	it('returns synced when lrc-kit parses timed lyric lines', () => {
		const input = [
			'[00:01.00]first line',
			'[00:05.50]second line',
			'[00:10.00]third line',
			'[01:00.00]fourth line'
		].join('\n');
		expect(detectLyricsStatus(input)).toBe('synced');
	});

	it('returns plain when no brackets and no timestamps', () => {
		expect(detectLyricsStatus('verse one\nverse two\nchorus')).toBe('plain');
	});

	it('returns invalid when all non-metadata lines are empty bracket tags', () => {
		expect(detectLyricsStatus('[bad]\n[wrong]\n')).toBe('invalid');
	});

	it('returns plain when bracket lines contain text content', () => {
		expect(detectLyricsStatus('[bad]hello\nworld\n')).toBe('plain');
	});

	it('returns synced for short LRC stamps without centiseconds', () => {
		expect(detectLyricsStatus('[00:01]a\n[00:02]b\n[00:03]c')).toBe('synced');
	});

	it('ignores LRC metadata tags when detecting synced lyrics', () => {
		const input = [
			'[ti:Someone Like You]',
			'[ar:Adele]',
			'[by:SpotiFlac]',
			'',
			'[00:14.01]I heard that you\'re settled down',
			'[00:21.03]That you found a girl and you\'re married now',
			'[01:10.57]'
		].join('\n');
		expect(detectLyricsStatus(input)).toBe('synced');
	});

	it('returns none for metadata-only LRC with no timed lines', () => {
		const input = [
			'[ti:Someone Like You]',
			'[ar:Adele]',
			'[by:SpotiFlac]'
		].join('\n');
		expect(detectLyricsStatus(input)).toBe('none');
	});

	it('treats CRLF input the same as LF', () => {
		const lrc = '[00:01.00]a\r\n[00:02.00]b\r\n';
		expect(detectLyricsStatus(lrc)).toBe('synced');
	});

	it('returns synced for multi-timestamp lines', () => {
		expect(detectLyricsStatus('[00:01.00][00:02.00]repeat')).toBe('synced');
	});

	it('returns synced when blank timed lines are present', () => {
		expect(detectLyricsStatus('[00:01.00]a\n[00:02.50]\n[00:03.00]c')).toBe('synced');
	});
});

describe('parseSyncedLrc', () => {
	it('parses synced LRC into ordered timeMs/text pairs', () => {
		const result = parseSyncedLrc([
			'[00:05.50]second',
			'[00:01.00]first',
			'[00:10.00]third'
		].join('\n'));
		expect(result).toEqual([
			{ timeMs: 1000, text: 'first' },
			{ timeMs: 5500, text: 'second' },
			{ timeMs: 10000, text: 'third' }
		]);
	});

	it('returns empty for plain text', () => {
		expect(parseSyncedLrc('hello\nworld')).toEqual([]);
	});

	it('handles multi-timestamp lines', () => {
		const result = parseSyncedLrc('[00:01.00][00:02.00]repeat');
		expect(result).toEqual([
			{ timeMs: 1000, text: 'repeat' },
			{ timeMs: 2000, text: 'repeat' }
		]);
	});

	it('handles blank timed lines', () => {
		const result = parseSyncedLrc('[00:01.00]a\n[00:02.50]\n[00:03.00]c');
		expect(result).toEqual([
			{ timeMs: 1000, text: 'a' },
			{ timeMs: 2500, text: '' },
			{ timeMs: 3000, text: 'c' }
		]);
	});

	it('drops metadata tags and plain text', () => {
		const result = parseSyncedLrc([
			'[ti:Title]',
			'[00:01.00]line',
			'plain text'
		].join('\n'));
		expect(result).toEqual([{ timeMs: 1000, text: 'line' }]);
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

describe('activeTimeMs', () => {
	const makeLine = (timeMs: number, text = 'x'): { timeMs: number; text: string } => ({
		timeMs,
		text
	});

	it('returns null when lines is empty', () => {
		expect(activeTimeMs([], 1000)).toBeNull();
	});

	it('returns null when currentMs is before the first timeMs', () => {
		expect(activeTimeMs([makeLine(500), makeLine(1000)], 0)).toBeNull();
	});

	it('returns the line timeMs when currentMs equals it exactly', () => {
		expect(activeTimeMs([makeLine(1000)], 1000)).toBe(1000);
	});

	it('returns the latest timeMs <= currentMs for mid-song progression', () => {
		const lines = [makeLine(1000), makeLine(2000), makeLine(3000), makeLine(4000)];
		expect(activeTimeMs(lines, 2500)).toBe(2000);
		expect(activeTimeMs(lines, 2000)).toBe(2000);
		expect(activeTimeMs(lines, 3000)).toBe(3000);
	});

	it('returns the shared timeMs when multiple lines share it (ties)', () => {
		const lines = [
			makeLine(1000, 'original'),
			makeLine(1000, 'romanised'),
			makeLine(3000, 'next')
		];
		expect(activeTimeMs(lines, 1500)).toBe(1000);
	});

	it('returns the shared timeMs exactly at the boundary (currentMs === shared)', () => {
		const lines = [
			makeLine(1000, 'original'),
			makeLine(1000, 'romanised')
		];
		expect(activeTimeMs(lines, 1000)).toBe(1000);
	});

	it('returns the last line timeMs when currentMs is past all lines', () => {
		const lines = [makeLine(1000), makeLine(2000)];
		expect(activeTimeMs(lines, 5000)).toBe(2000);
	});

	it('handles a line at timeMs: 0 with currentMs: 0 (returns 0, not null)', () => {
		expect(activeTimeMs([makeLine(0)], 0)).toBe(0);
	});
});
