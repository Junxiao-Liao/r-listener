// Deterministic placeholder for tracks/playlists/albums that don't have a
// cover image. The same seed (e.g. track title) always produces the same
// hue, so the same track keeps the same color across reloads.

export type CoverPlaceholder = {
	bg: string;
	letter: string;
};

export function makeCoverPlaceholder(seed: string | null | undefined): CoverPlaceholder {
	const trimmed = (seed ?? '').trim();
	const letter = trimmed.length > 0 ? trimmed[0]!.toUpperCase() : '?';
	const hash = djb2(trimmed.toLowerCase() || '?');
	const hue = hash % 360;
	return { bg: `hsl(${hue} 55% 45%)`, letter };
}

function djb2(s: string): number {
	let h = 5381;
	for (let i = 0; i < s.length; i++) {
		h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
	}
	return h;
}
