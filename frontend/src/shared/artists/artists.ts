import type { ArtistDto, TrackDto } from '$shared/types/dto';

export function artistDisplayName(artists: readonly Pick<ArtistDto, 'name'>[]): string {
	return artists.map((artist) => artist.name).join(', ');
}

export function trackArtistDisplay(track: Pick<TrackDto, 'artists'>): string {
	return artistDisplayName(track.artists);
}

export function dedupeArtistNames(names: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];

	for (const name of names) {
		const trimmed = name.trim();
		if (trimmed.length === 0) continue;
		const key = trimmed.normalize('NFKC').toLocaleLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(trimmed);
	}

	return out;
}

export function renameArtist(
	names: readonly string[],
	oldName: string,
	newName: string
): string[] {
	const trimmed = newName.trim();
	if (trimmed.length === 0) return names.filter((n) => n !== oldName);
	const oldKey = oldName.trim().normalize('NFKC').toLocaleLowerCase();
	return names.map((n) => {
		const key = n.trim().normalize('NFKC').toLocaleLowerCase();
		return key === oldKey ? trimmed : n;
	});
}
