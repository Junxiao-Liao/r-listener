import { Lrc } from 'lrc-kit';

export type LyricsStatus = 'none' | 'synced' | 'plain' | 'invalid';

const METADATA_RE = /^\[[A-Za-z]+:[^\]]*\]$/;

export function detectLyricsStatus(input: string | null | undefined): LyricsStatus {
	if (!input || input.trim().length === 0) return 'none';

	const lrc = Lrc.parse(input);

	if (lrc.lyrics.length > 0) return 'synced';

	const lines = input.split(/\r?\n/);
	let hasValidText = false;
	let hasBracketOnlyLines = false;

	for (const raw of lines) {
		const line = raw.trim();
		if (line.length === 0) continue;
		if (METADATA_RE.test(line)) continue;

		const bracketEnd = line.indexOf(']');
		if (line.startsWith('[') && bracketEnd >= 0) {
			const afterBracket = line.slice(bracketEnd + 1).trim();
			if (afterBracket.length === 0) {
				hasBracketOnlyLines = true;
				continue;
			}
		}
		hasValidText = true;
	}

	if (hasValidText) return 'plain';
	if (hasBracketOnlyLines) return 'invalid';
	return 'none';
}

export type SyltFrame = { timeMs: number; text: string };

export function syltFramesToLrc(frames: SyltFrame[]): string {
	return frames.map((f) => `${formatLrcStamp(f.timeMs)}${f.text}`).join('\n');
}

export function formatLrcStamp(ms: number): string {
	const total = Math.max(0, Math.floor(ms));
	const minutes = Math.floor(total / 60000);
	const seconds = Math.floor((total % 60000) / 1000);
	const cs = Math.floor((total % 1000) / 10);
	return `[${pad2(minutes)}:${pad2(seconds)}.${pad2(cs)}]`;
}

function pad2(n: number): string {
	return n.toString().padStart(2, '0');
}

export type LrcLine = { timeMs: number; text: string };

export function parseSyncedLrc(input: string): LrcLine[] {
	const lrc = Lrc.parse(input);
	return lrc.lyrics
		.map((l) => ({ timeMs: l.timestamp * 1000, text: l.content }))
		.sort((a, b) => a.timeMs - b.timeMs);
}
