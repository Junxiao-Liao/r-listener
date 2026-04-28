// Browser-side lyrics helpers. Status detection mirrors the backend's
// parseLyricsStatus rules so the user sees the same classification on Upload
// Review as the server will derive on finalize.

export type LyricsStatus = 'none' | 'synced' | 'plain' | 'invalid';

const LRC_LINE = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/;
const ANY_BRACKET_LINE = /^\[.*\]/;

export function detectLyricsStatus(input: string | null | undefined): LyricsStatus {
	if (!input || input.trim().length === 0) return 'none';

	const lines = input.split(/\r?\n/);
	let total = 0;
	let lrc = 0;
	let bracketed = 0;

	for (const raw of lines) {
		const line = raw.trim();
		if (line.length === 0) continue;
		total++;

		const isLrc = LRC_LINE.test(line);
		if (isLrc) lrc++;

		if (ANY_BRACKET_LINE.test(line)) {
			bracketed++;
			if (!isLrc) return 'invalid';
		}
	}

	if (total === 0) return 'none';
	if (lrc > 0 && lrc / total >= 0.8) return 'synced';
	if (bracketed > 0 && lrc / total < 0.8) return 'invalid';
	return 'plain';
}

export type SyltFrame = { timeMs: number; text: string };

export function syltFramesToLrc(frames: SyltFrame[]): string {
	return frames.map((f) => `${formatLrcStamp(f.timeMs)}${f.text}`).join('\n');
}

function formatLrcStamp(ms: number): string {
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

// Parse synced LRC into ordered { timeMs, text } pairs. Lines without a
// matching stamp are dropped. Used by the lyrics view; safe to call on plain
// text (returns []).
export function parseSyncedLrc(input: string): LrcLine[] {
	const out: LrcLine[] = [];
	for (const raw of input.split(/\r?\n/)) {
		const line = raw.trim();
		const match = LRC_LINE.exec(line);
		if (!match) continue;
		const minutes = Number(match[1]);
		const seconds = Number(match[2]);
		const fractionRaw = match[3] ?? '0';
		const fraction = Number(fractionRaw.padEnd(3, '0').slice(0, 3));
		const timeMs = minutes * 60_000 + seconds * 1_000 + fraction;
		const text = line.slice(match[0].length).trim();
		out.push({ timeMs, text });
	}
	out.sort((a, b) => a.timeMs - b.timeMs);
	return out;
}
