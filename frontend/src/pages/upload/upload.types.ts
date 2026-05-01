import type { EmbeddedCover, ExtractedMetadata } from '$shared/upload/metadata';
import type { Id } from '$shared/types/dto';
import { artistDisplayName } from '$shared/artists/artists';

export type UploadItem = {
	id: string;
	audio: File;
	externalLrc: File | null;
	resolvedLyricsLrc: string | null;
	lyricsSource: 'external' | 'embedded' | 'none';
	embeddedCover: EmbeddedCover | null;
	title: string;
	artistNames: string[];
	album: string | null;
	trackNumber: number | null;
	genre: string | null;
	year: number | null;
	durationMs: number | null;
};

export type UploadProgressItem = {
	item: UploadItem;
	trackId: Id<'track'> | null;
	status: 'queued' | 'uploading' | 'finalizing' | 'done' | 'error';
	progress: number;
	error: string | null;
};

export type UploadStep = 'pick' | 'review' | 'progress';

export function makeId(): string {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function metadataToItem(
	audio: File,
	externalLrc: File | null,
	parsed: ExtractedMetadata,
	externalLrcText: string | null
): UploadItem {
	let resolvedLyricsLrc: string | null;
	let lyricsSource: UploadItem['lyricsSource'];
	if (externalLrcText && externalLrcText.trim().length > 0) {
		resolvedLyricsLrc = externalLrcText;
		lyricsSource = 'external';
	} else if (parsed.embeddedLyricsLrc && parsed.embeddedLyricsLrc.trim().length > 0) {
		resolvedLyricsLrc = parsed.embeddedLyricsLrc;
		lyricsSource = 'embedded';
	} else {
		resolvedLyricsLrc = null;
		lyricsSource = 'none';
	}

	return {
		id: makeId(),
		audio,
		externalLrc,
		resolvedLyricsLrc,
		lyricsSource,
		embeddedCover: parsed.embeddedCover,
		title: parsed.title,
		artistNames: parsed.artistNames,
		album: parsed.album,
		trackNumber: parsed.trackNumber,
		genre: parsed.genre,
		year: parsed.year,
		durationMs: parsed.durationMs
	};
}

export function swapUploadItemTitleAndArtists(item: UploadItem): UploadItem {
	const oldTitle = item.title.trim();
	return {
		...item,
		title: artistDisplayName(item.artistNames.map((name) => ({ name }))) || item.title,
		artistNames: oldTitle.length > 0 ? [oldTitle] : []
	};
}
