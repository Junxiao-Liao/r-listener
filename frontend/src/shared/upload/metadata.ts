// Browser-side metadata extraction. Wraps music-metadata-browser with a small
// shape that matches what Upload Review needs. Falls back to filename-derived
// title when the audio has no embedded metadata.

import { parseBlob } from 'music-metadata-browser';
import { syltFramesToLrc, type SyltFrame } from '$shared/lyrics/lyrics';
import { stripExt } from './pairing';

export type EmbeddedCover = {
	bytes: Uint8Array;
	mime: string;
};

export type ExtractedMetadata = {
	title: string;
	artist: string | null;
	album: string | null;
	trackNumber: number | null;
	genre: string | null;
	year: number | null;
	durationMs: number | null;
	embeddedLyricsLrc: string | null;
	embeddedCover: EmbeddedCover | null;
};

export async function extractMetadata(file: File): Promise<ExtractedMetadata> {
	const fallbackTitle = stripExt(file.name);
	let parsed: Awaited<ReturnType<typeof parseBlob>> | null = null;
	try {
		parsed = await parseBlob(file);
	} catch {
		parsed = null;
	}

	const common = parsed?.common ?? null;
	const format = parsed?.format ?? null;

	return {
		title: common?.title?.trim() || fallbackTitle,
		artist: pickFirstString(common?.artist, common?.artists),
		album: stringOrNull(common?.album),
		trackNumber: typeof common?.track?.no === 'number' ? common.track.no : null,
		genre: pickFirstString(undefined, common?.genre),
		year: typeof common?.year === 'number' ? common.year : null,
		durationMs:
			typeof format?.duration === 'number' && Number.isFinite(format.duration)
				? Math.round(format.duration * 1000)
				: null,
		embeddedLyricsLrc: extractEmbeddedLyrics(common?.lyrics),
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

function extractEmbeddedLyrics(tags: unknown): string | null {
	if (!Array.isArray(tags) || tags.length === 0) return null;

	for (const tag of tags as Array<Record<string, unknown>>) {
		const synced = tag.syncText as
			| Array<{ timestamp?: number; text?: string }>
			| undefined;
		if (Array.isArray(synced) && synced.length > 0) {
			const frames: SyltFrame[] = synced
				.map((s) => ({
					timeMs: Math.max(0, Math.round(s.timestamp ?? 0)),
					text: typeof s.text === 'string' ? s.text : ''
				}))
				.filter((f) => f.text.length > 0);
			if (frames.length > 0) return syltFramesToLrc(frames);
		}
	}

	for (const tag of tags as Array<Record<string, unknown>>) {
		const text = tag.text;
		if (typeof text === 'string' && text.trim().length > 0) return text;
	}

	return null;
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
