import { describe, expect, it } from 'vitest';
import {
	deriveTitleFromFilename,
	isAudioFile,
	pairAudioAndLrcFiles,
	stripExt
} from './pairing';

function makeFile(name: string, type = ''): File {
	return new File([new Uint8Array([0])], name, { type });
}

describe('isAudioFile', () => {
	it('accepts files with audio/* MIME', () => {
		expect(isAudioFile(makeFile('a.mp3', 'audio/mpeg'))).toBe(true);
	});

	it('accepts known audio extensions even without a MIME', () => {
		expect(isAudioFile(makeFile('a.flac'))).toBe(true);
		expect(isAudioFile(makeFile('a.M4A'))).toBe(true);
	});

	it('rejects unrelated files', () => {
		expect(isAudioFile(makeFile('a.lrc'))).toBe(false);
		expect(isAudioFile(makeFile('a.txt'))).toBe(false);
	});
});

describe('pairAudioAndLrcFiles', () => {
	it('pairs audio with sibling .lrc by base filename', () => {
		const audio = makeFile('Song A.mp3', 'audio/mpeg');
		const lrc = makeFile('Song A.lrc', 'text/plain');
		const result = pairAudioAndLrcFiles([audio, lrc]);
		expect(result.paired).toEqual([{ audio, lrc }]);
		expect(result.ignored).toEqual([]);
	});

	it('matches base filename case-insensitively', () => {
		const audio = makeFile('SONG.mp3', 'audio/mpeg');
		const lrc = makeFile('song.LRC');
		const result = pairAudioAndLrcFiles([audio, lrc]);
		expect(result.paired[0]?.lrc).toBe(lrc);
	});

	it('leaves audio without a matching lrc unpaired', () => {
		const audio = makeFile('A.mp3', 'audio/mpeg');
		const result = pairAudioAndLrcFiles([audio]);
		expect(result.paired).toEqual([{ audio, lrc: null }]);
	});

	it('reports orphan .lrc and unsupported files as ignored', () => {
		const lrc = makeFile('Lonely.lrc');
		const txt = makeFile('readme.txt');
		const result = pairAudioAndLrcFiles([lrc, txt]);
		expect(result.paired).toEqual([]);
		expect(result.ignored).toEqual(expect.arrayContaining([lrc, txt]));
	});

	it('does not double-assign one lrc to multiple audios', () => {
		const a = makeFile('Track.mp3', 'audio/mpeg');
		const b = makeFile('Track.flac', 'audio/flac');
		const lrc = makeFile('Track.lrc');
		const result = pairAudioAndLrcFiles([a, b, lrc]);
		const pairedWithLrc = result.paired.filter((p) => p.lrc !== null);
		expect(pairedWithLrc).toHaveLength(1);
	});
});

describe('deriveTitleFromFilename / stripExt', () => {
	it('strips trailing extension', () => {
		expect(stripExt('My Track.mp3')).toBe('My Track');
		expect(stripExt('no ext')).toBe('no ext');
	});

	it('uses the base filename as a fallback title', () => {
		expect(deriveTitleFromFilename('My Track.mp3')).toBe('My Track');
		expect(deriveTitleFromFilename('untagged')).toBe('untagged');
	});
});
