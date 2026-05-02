import { describe, expect, it } from 'vitest';
import { parseSyncedLrc } from '$shared/lyrics/lyrics';
import { extractEmbeddedLyrics, mergeLrcCandidates } from './metadata';

describe('mergeLrcCandidates', () => {
	it('returns empty string for empty array', () => {
		expect(mergeLrcCandidates([])).toBe('');
	});

	it('returns first non-empty candidate for plain text (no LRC stamps)', () => {
		expect(mergeLrcCandidates(['Hello world'])).toBe('Hello world');
	});

	it('drops empty/whitespace-only candidates', () => {
		expect(mergeLrcCandidates(['   ', 'Actual text'])).toBe('Actual text');
	});

	it('returns LRC when all candidates are LRC-stamped', () => {
		const result = mergeLrcCandidates([
			'[00:01.00]Line 1\n[00:02.00]Line 2'
		]);
		const parsed = parseSyncedLrc(result);
		expect(parsed).toHaveLength(2);
		expect(parsed[0].text).toBe('Line 1');
		expect(parsed[1].text).toBe('Line 2');
	});

	it('merges two LRC candidates, sorting by timeMs', () => {
		const result = mergeLrcCandidates([
			'[00:02.00]Line B\n[00:04.00]Line D',
			'[00:01.00]Line A\n[00:03.00]Line C'
		]);
		const parsed = parseSyncedLrc(result);
		expect(parsed).toHaveLength(4);
		expect(parsed[0].text).toBe('Line A');
		expect(parsed[1].text).toBe('Line B');
		expect(parsed[2].text).toBe('Line C');
		expect(parsed[3].text).toBe('Line D');
	});

	it('keeps same-timestamp lines as adjacent LRC lines', () => {
		const result = mergeLrcCandidates([
			'[00:01.00]Chinese\n[00:02.00]更多中文',
			'[00:01.00]Romanised\n[00:02.00]more romanised'
		]);
		const parsed = parseSyncedLrc(result);
		expect(parsed).toHaveLength(4);

		// Both lines at 00:01.00 should appear (order preserved per-candidate within same timeMs)
		const firstGroup = parsed.filter((l) => l.timeMs === 1000);
		expect(firstGroup).toHaveLength(2);
		expect(firstGroup.map((l) => l.text)).toContain('Chinese');
		expect(firstGroup.map((l) => l.text)).toContain('Romanised');

		// Both lines at 00:02.00
		const secondGroup = parsed.filter((l) => l.timeMs === 2000);
		expect(secondGroup).toHaveLength(2);
		expect(secondGroup.map((l) => l.text)).toContain('更多中文');
		expect(secondGroup.map((l) => l.text)).toContain('more romanised');
	});

	it('drops non-LRC candidates when at least one candidate has stamps', () => {
		const result = mergeLrcCandidates([
			'Plain text only',
			'[00:01.00]Timed line'
		]);
		const parsed = parseSyncedLrc(result);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].text).toBe('Timed line');
	});

	it('falls back to first non-empty plain text when no candidate has stamps', () => {
		const result = mergeLrcCandidates([
			'   ',
			'Plain text one',
			'Plain text two'
		]);
		expect(result).toBe('Plain text one');
	});
});

describe('extractEmbeddedLyrics', () => {
	const parsedNull = null;
	const parsedEmpty: Record<string, unknown> = {
		common: { lyrics: undefined },
		native: {}
	};

	it('returns null for null parsed', () => {
		expect(extractEmbeddedLyrics(parsedNull)).toBeNull();
	});

	it('returns null for empty native and empty common.lyrics', () => {
		expect(extractEmbeddedLyrics(parsedEmpty)).toBeNull();
	});

	it('extracts single USLT (LRC-formatted) from ID3v2.3', () => {
		const text = '[00:01.00]Line 1\n[00:02.00]Line 2';
		const parsed = {
			common: {},
			native: {
				'ID3v2.3': [
					{ id: 'USLT', value: { language: 'zho', description: '', text } }
				]
			}
		};
		const result = extractEmbeddedLyrics(parsed)!;
		const parsed1 = parseSyncedLrc(result);
		expect(parsed1).toHaveLength(2);
		expect(parsed1[0].text).toBe('Line 1');
		expect(parsed1[1].text).toBe('Line 2');
	});

	it('extracts single USLT (plain text, no stamps)', () => {
		const text = 'Plain lyrics without timestamps';
		const parsed = {
			common: {},
			native: {
				'ID3v2.4': [
					{ id: 'USLT', value: { language: 'eng', description: '', text } }
				]
			}
		};
		expect(extractEmbeddedLyrics(parsed)).toBe(text);
	});

	it('merges two USLT frames across ID3 versions', () => {
		const parsed = {
			common: {},
			native: {
				'ID3v2.3': [
					{ id: 'USLT', value: { language: 'zho', description: '', text: '[00:01.00]Chinese' } }
				],
				'ID3v2.4': [
					{ id: 'USLT', value: { language: 'eng', description: '', text: '[00:02.00]English' } }
				]
			}
		};
		const result = extractEmbeddedLyrics(parsed)!;
		const parsed1 = parseSyncedLrc(result);
		expect(parsed1).toHaveLength(2);
		expect(parsed1[0].text).toBe('Chinese');
		expect(parsed1[1].text).toBe('English');
	});

	it('merges two USLT frames sharing timestamps (bilingual LRC)', () => {
		const parsed = {
			common: {},
			native: {
				'ID3v2.3': [
					{
						id: 'USLT',
						value: {
							language: 'zho',
							description: '',
							text: '[00:31.57]笑容还在眼神还在往昔\n[00:35.00]句句都是痛惜'
						}
					},
					{
						id: 'USLT',
						value: {
							language: 'eng',
							description: '',
							text: '[00:31.57]siu yong wan zoi an san wan zoi wong si\n[00:35.00]geoi geoi dou si tung sik'
						}
					}
				]
			}
		};
		const result = extractEmbeddedLyrics(parsed)!;
		const parsed1 = parseSyncedLrc(result);
		expect(parsed1).toHaveLength(4);

		const t3157 = parsed1.filter((l) => Math.abs(l.timeMs - 31570) < 5);
		expect(t3157).toHaveLength(2);
		expect(t3157.map((l) => l.text)).toContain('笑容还在眼神还在往昔');
		expect(t3157.map((l) => l.text)).toContain('siu yong wan zoi an san wan zoi wong si');

		const t3500 = parsed1.filter((l) => Math.abs(l.timeMs - 35000) < 5);
		expect(t3500).toHaveLength(2);
	});

	it('recognises ULT (ID3v2.2) same as USLT', () => {
		const text = '[00:01.00]Old format line';
		const parsed = {
			common: {},
			native: {
				'ID3v2.2': [
					{ id: 'ULT', value: { language: 'zho', description: '', text } }
				]
			}
		};
		const result = extractEmbeddedLyrics(parsed)!;
		const parsed1 = parseSyncedLrc(result);
		expect(parsed1).toHaveLength(1);
		expect(parsed1[0].text).toBe('Old format line');
	});

	it('extracts MP4 \u00a9lyr plain string', () => {
		const text = '[00:01.00]MP4 lyric';
		const parsed = {
			common: {},
			native: {
				'iTunes MP4': [{ id: '\u00a9lyr', value: text }]
			}
		};
		const result = extractEmbeddedLyrics(parsed)!;
		const parsed1 = parseSyncedLrc(result);
		expect(parsed1).toHaveLength(1);
		expect(parsed1[0].text).toBe('MP4 lyric');
	});

	it('extracts Vorbis LYRICS tag', () => {
		const text = 'Vorbis plain lyrics';
		const parsed = {
			common: {},
			native: {
				vorbis: [{ id: 'LYRICS', value: text }]
			}
		};
		expect(extractEmbeddedLyrics(parsed)).toBe(text);
	});

	it('extracts Vorbis SYNCEDLYRICS tag', () => {
		const text = '[00:01.00]Synced vorbis';
		const parsed = {
			common: {},
			native: {
				vorbis: [{ id: 'SYNCEDLYRICS', value: text }]
			}
		};
		const result = extractEmbeddedLyrics(parsed)!;
		const parsed1 = parseSyncedLrc(result);
		expect(parsed1).toHaveLength(1);
	});

	it('extracts APEv2 lyrics tag', () => {
		const text = 'APEv2 lyric text';
		const parsed = {
			common: {},
			native: {
				APEv2: [{ id: 'lyrics', value: text }]
			}
		};
		expect(extractEmbeddedLyrics(parsed)).toBe(text);
	});

	it('falls back to common.lyrics when native has only empty values', () => {
		const parsed = {
			common: { lyrics: ['Common fallback lyric'] },
			native: {
				'ID3v2.3': [
					{ id: 'USLT', value: { language: 'zho', description: '', text: '   ' } }
				]
			}
		};
		expect(extractEmbeddedLyrics(parsed)).toBe('Common fallback lyric');
	});

	it('returns null when native empty and common.lyrics empty', () => {
		const parsed = {
			common: { lyrics: ['   ', ''] },
			native: {}
		};
		expect(extractEmbeddedLyrics(parsed)).toBeNull();
	});
});
