// Browser-side metadata extraction. Wraps music-metadata-browser with a small
// shape that matches what Upload Review needs.

import { parseBlob } from 'music-metadata-browser';
import { parseSyncedLrc, syltFramesToLrc } from '$shared/lyrics/lyrics';
import { parseFilenameMetadata, splitArtistNames } from './filename-metadata';

export type EmbeddedCover = {
	bytes: Uint8Array;
	mime: string;
};

export type ExtractedMetadata = {
	title: string;
	artistNames: string[];
	album: string | null;
	trackNumber: number | null;
	genre: string | null;
	year: number | null;
	durationMs: number | null;
	embeddedLyricsLrc: string | null;
	embeddedCover: EmbeddedCover | null;
};

export async function extractMetadata(file: File): Promise<ExtractedMetadata> {
	const filenameMetadata = parseFilenameMetadata(file.name);
	let parsed: Awaited<ReturnType<typeof parseBlob>> | null = null;
	try {
		parsed = await parseBlob(file);
	} catch {
		parsed = null;
	}

	const common = parsed?.common ?? null;
	const format = parsed?.format ?? null;
	const embeddedArtistNames = splitArtistNames(
		[common?.artist, ...(common?.artists ?? [])].filter(
			(value): value is string => !!value && value.trim().length > 0
		)
	);

	return {
		title: common?.title?.trim() || filenameMetadata.title || filenameMetadata.baseTitle,
		artistNames:
			embeddedArtistNames.length > 0 ? embeddedArtistNames : filenameMetadata.artistNames,
		album: stringOrNull(common?.album),
		trackNumber: typeof common?.track?.no === 'number' ? common.track.no : null,
		genre: pickFirstString(undefined, common?.genre),
		year: typeof common?.year === 'number' ? common.year : null,
		durationMs:
			typeof format?.duration === 'number' && Number.isFinite(format.duration)
				? Math.round(format.duration * 1000)
				: null,
		embeddedLyricsLrc: extractEmbeddedLyrics(parsed),
		embeddedCover: extractEmbeddedCover(common?.picture)
	};
}

function pickFirstString(
	primary: string | undefined,
	list: readonly string[] | undefined
): string | null {
	if (primary && primary.trim().length > 0) return primary.trim();
	if (list && list.length > 0) {
		for (const v of list) {
			if (v && v.trim().length > 0) return v.trim();
		}
	}
	return null;
}

function stringOrNull(v: string | undefined): string | null {
	if (!v) return null;
	const trimmed = v.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function extractEmbeddedLyrics(parsed: { native?: unknown; common?: unknown } | null): string | null {
	if (!parsed) return null;

	const candidates: string[] = [];

	const nat = parsed.native as Record<string, Array<{ id: string; value: unknown }>> | undefined;
	if (nat) {
		for (const version of ['ID3v2.4', 'ID3v2.3', 'ID3v2.2']) {
			const tags = nat[version];
			if (Array.isArray(tags)) {
				for (const tag of tags) {
					if (tag.id === 'USLT' || tag.id === 'ULT') {
						const val = tag.value as { text?: string } | undefined;
						if (val && typeof val.text === 'string' && val.text.trim().length > 0) {
							candidates.push(val.text);
						}
					}
				}
			}
		}

		for (const key of ['iTunes MP4', 'iTunes']) {
			const tags = nat[key];
			if (Array.isArray(tags)) {
				for (const tag of tags) {
					if (tag.id === '\u00a9lyr' && typeof tag.value === 'string' && tag.value.trim().length > 0) {
						candidates.push(tag.value);
					}
				}
			}
		}

		const vorbisTags = nat['vorbis'];
		if (Array.isArray(vorbisTags)) {
			for (const tag of vorbisTags) {
				const upperId = String(tag.id).toUpperCase();
				if (
					(upperId === 'LYRICS' || upperId === 'SYNCEDLYRICS' || upperId === 'UNSYNCEDLYRICS') &&
					typeof tag.value === 'string' &&
					tag.value.trim().length > 0
				) {
					candidates.push(tag.value);
				}
			}
		}

		const apeTags = nat['APEv2'];
		if (Array.isArray(apeTags)) {
			for (const tag of apeTags) {
				if (
					String(tag.id).toLowerCase() === 'lyrics' &&
					typeof tag.value === 'string' &&
					tag.value.trim().length > 0
				) {
					candidates.push(tag.value);
				}
			}
		}
	}

	if (candidates.length === 0) {
		const common = parsed.common as { lyrics?: readonly string[] } | undefined;
		const lyrics = common?.lyrics;
		if (Array.isArray(lyrics)) {
			for (const l of lyrics) {
				if (typeof l === 'string' && l.trim().length > 0) {
					candidates.push(l);
				}
			}
		}
	}

	if (candidates.length === 0) return null;

	return mergeLrcCandidates(candidates);
}

export function mergeLrcCandidates(candidates: string[]): string {
	if (candidates.length === 0) return '';

	const parsed = candidates.map((text) => ({ text, lines: parseSyncedLrc(text) }));
	const anyTimed = parsed.some((p) => p.lines.length > 0);

	if (!anyTimed) {
		return candidates.find((c) => c.trim().length > 0) ?? '';
	}

	const frames = parsed.flatMap((p) => p.lines);
	frames.sort((a, b) => a.timeMs - b.timeMs);

	const seen = new Set<string>();
	const deduped = frames.filter((f) => {
		const key = `${f.timeMs}|${f.text}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	return syltFramesToLrc(deduped);
}

function extractEmbeddedCover(pictures: unknown): EmbeddedCover | null {
	if (!Array.isArray(pictures) || pictures.length === 0) return null;
	const first = pictures[0] as { data?: Uint8Array; format?: string } | undefined;
	if (!first?.data) return null;
	return {
		bytes: first.data,
		mime: first.format && first.format.length > 0 ? first.format : 'image/jpeg'
	};
}
