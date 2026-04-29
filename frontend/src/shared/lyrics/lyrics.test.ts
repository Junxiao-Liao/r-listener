import { describe, expect, it } from 'vitest';
import { detectLyricsStatus, parseSyncedLrc, syltFramesToLrc } from './lyrics';

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
