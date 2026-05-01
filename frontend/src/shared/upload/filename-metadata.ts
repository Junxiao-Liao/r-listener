import { dedupeArtistNames } from '$shared/artists/artists';

const DASH_RE = /\s*[-‐‑‒–—―－]\s*/u;
const ARTIST_SEPARATOR_RE = /\s*(?:,|，|、|﹐|､|;|；|\+|＋|&|＆|\band\b)\s*/iu;

export type ParsedFilenameMetadata = {
	baseTitle: string;
	title: string | null;
	artistNames: string[];
};

export function parseFilenameMetadata(filename: string): ParsedFilenameMetadata {
	const baseTitle = stripExtension(filename).trim() || filename.trim();
	const match = DASH_RE.exec(baseTitle);
	if (!match || match.index <= 0) {
		return { baseTitle, title: null, artistNames: [] };
	}

	const title = baseTitle.slice(0, match.index).trim();
	const artistsPart = baseTitle.slice(match.index + match[0].length).trim();

	return {
		baseTitle,
		title: title.length > 0 ? title : null,
		artistNames: splitArtistNames(artistsPart)
	};
}

export function splitArtistNames(value: string | readonly string[] | null | undefined): string[] {
	if (!value) return [];
	const values = Array.isArray(value) ? value : [value];
	return dedupeArtistNames(values.flatMap((item) => item.split(ARTIST_SEPARATOR_RE)));
}

function stripExtension(filename: string): string {
	const dotIndex = filename.lastIndexOf('.');
	return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}
