export function normalizeArtistName(name: string): string | null {
	const trimmed = name.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function artistNameKey(name: string): string {
	return name.trim().normalize('NFKC').toLocaleLowerCase();
}

export function dedupeArtistNames(names: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];

	for (const value of names) {
		const normalized = normalizeArtistName(value);
		if (!normalized) continue;
		const key = artistNameKey(normalized);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(normalized);
	}

	return out;
}
