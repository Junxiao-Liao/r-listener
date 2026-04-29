import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { createId } from '../shared/id';
import { apiError } from '../http/api-error';
import type { CreateTrackInput, FinalizeTrackInput, LyricsInput, TrackQuery, UpdateTrackInput } from './tracks.dto';
import type { ListTracksResult, TracksRepository } from './tracks.repository';
import { createTracksRepository } from './tracks.repository';
import type { LyricsStatus, TrackDto } from './tracks.type';
import { Lrc } from 'lrc-kit';

const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB

const SUPPORTED_MIME_TYPES = new Set([
	'audio/mpeg',
	'audio/mp4',
	'audio/mp3',
	'audio/ogg',
	'audio/flac',
	'audio/x-flac',
	'audio/wav',
	'audio/wave',
	'audio/x-wav',
	'audio/x-pn-wav',
	'audio/aac',
	'audio/x-m4a',
	'audio/webm'
]);

const MIME_TO_EXT: Record<string, string> = {
	'audio/mpeg': 'mp3',
	'audio/mp4': 'm4a',
	'audio/mp3': 'mp3',
	'audio/ogg': 'ogg',
	'audio/flac': 'flac',
	'audio/x-flac': 'flac',
	'audio/wav': 'wav',
	'audio/wave': 'wav',
	'audio/x-wav': 'wav',
	'audio/x-pn-wav': 'wav',
	'audio/aac': 'aac',
	'audio/x-m4a': 'm4a',
	'audio/webm': 'webm'
};

const EXT_TO_MIME: Record<string, string> = {
	mp3: 'audio/mpeg',
	mp4: 'audio/mp4',
	m4a: 'audio/mp4',
	m4b: 'audio/mp4',
	ogg: 'audio/ogg',
	oga: 'audio/ogg',
	opus: 'audio/ogg',
	flac: 'audio/flac',
	wav: 'audio/wav',
	aac: 'audio/aac',
	webm: 'audio/webm',
	weba: 'audio/webm'
};

export type TracksService = {
	listTracks(input: ListServiceInput): Promise<ListTracksResult>;
	getTrack(trackId: Id<'track'>, tenantId: Id<'tenant'>): Promise<TrackDto | null>;
	createTrack(input: CreateTrackServiceInput): Promise<TrackDto>;
	finalizeTrack(input: FinalizeServiceInput): Promise<TrackDto>;
	updateTrack(input: UpdateTrackServiceInput): Promise<TrackDto>;
	setLyrics(input: SetLyricsServiceInput): Promise<TrackDto>;
	clearLyrics(trackId: Id<'track'>, tenantId: Id<'tenant'>): Promise<TrackDto>;
	softDeleteTrack(trackId: Id<'track'>, tenantId: Id<'tenant'>): Promise<TrackDto | null>;
	getStream(input: StreamInput): Promise<R2ObjectBody>;
};

export type UploadFile = {
	type: string;
	size: number;
	name: string;
	stream(): ReadableStream;
};

export type ListServiceInput = {
	tenantId: Id<'tenant'>;
	isEditor: boolean;
	query: TrackQuery;
};

export type CreateTrackServiceInput = {
	tenantId: Id<'tenant'>;
	uploaderId: Id<'user'>;
	file: UploadFile;
	metadata: CreateTrackInput;
};

export type FinalizeServiceInput = {
	trackId: Id<'track'>;
	tenantId: Id<'tenant'>;
	input: FinalizeTrackInput;
};

export type UpdateTrackServiceInput = {
	trackId: Id<'track'>;
	tenantId: Id<'tenant'>;
	input: UpdateTrackInput;
};

export type SetLyricsServiceInput = {
	trackId: Id<'track'>;
	tenantId: Id<'tenant'>;
	input: LyricsInput;
};

export type StreamInput = {
	trackId: Id<'track'>;
	tenantId: Id<'tenant'>;
	rangeHeader?: string | undefined;
};

export type TracksServiceDependencies = {
	tracksRepository: TracksRepository;
	r2: R2Bucket;
	now?: () => Date;
};

export function createTracksService(deps: TracksServiceDependencies): TracksService {
	const now = deps.now ?? (() => new Date());

	return {
		listTracks: async (input) => {
			if (input.query.includePending && !input.isEditor) {
				throw apiError(403, 'insufficient_role', 'Editor role required to view pending uploads.');
			}

			const [sortField, sortDir] = input.query.sort.split(':') as [string, string];

			return deps.tracksRepository.listTracks({
				tenantId: input.tenantId,
				cursor: input.query.cursor,
				limit: input.query.limit,
				sortField: sortField as never,
				sortDir: sortDir as never,
				q: input.query.q || undefined,
				includePending: input.query.includePending
			});
		},

		getTrack: async (trackId, tenantId) => {
			return deps.tracksRepository.findById(trackId, tenantId);
		},

		createTrack: async (input) => {
			const contentType = resolveContentType(input.file);

			if (input.file.size > MAX_AUDIO_BYTES) {
				throw apiError(413, 'payload_too_large', 'Audio file exceeds maximum size of 100 MB.');
			}

			if (input.file.size === 0) {
				throw apiError(400, 'upload_missing', 'Audio file is empty.');
			}

			const trackId = createId('trk_') as Id<'track'>;
			const ext = MIME_TO_EXT[contentType] ?? (getExt(input.file.name) || 'bin');
			const r2Key = `tenants/${input.tenantId}/tracks/${trackId}.${ext}`;

			const title = input.metadata.title || deriveTitleFromFilename(input.file.name);
			const now_ = now();

			const track = await deps.tracksRepository.createTrack({
				id: trackId,
				tenantId: input.tenantId,
				uploaderId: input.uploaderId,
				title,
				artist: input.metadata.artist ?? null,
				album: input.metadata.album ?? null,
				contentType,
				sizeBytes: input.file.size,
				audioR2Key: r2Key,
				now: now_
			});

			await deps.r2.put(r2Key, input.file.stream(), {
				httpMetadata: { contentType }
			});

			return track;
		},

		finalizeTrack: async (input) => {
			const track = await deps.tracksRepository.findRowById(input.trackId, input.tenantId);
			if (!track) {
				throw apiError(404, 'track_not_found', 'Track not found.');
			}

			if (track.status === 'ready') {
				throw apiError(409, 'track_already_finalized', 'Track has already been finalized.');
			}

			const r2Object = await deps.r2.head(track.audioR2Key);
			if (!r2Object) {
				throw apiError(400, 'upload_missing', 'Audio file not found in storage. Please re-upload.');
			}

			const lyricsLrc = input.input.lyricsLrc ?? null;
			const lyricsStatus = parseLyricsStatus(lyricsLrc);
			const now_ = now();

			return deps.tracksRepository.finalizeTrack({
				trackId: input.trackId,
				tenantId: input.tenantId,
				durationMs: input.input.durationMs,
				lyricsLrc,
				lyricsStatus,
				trackNumber: input.input.trackNumber ?? null,
				genre: input.input.genre ?? null,
				year: input.input.year ?? null,
				now: now_
			});
		},

		updateTrack: async (input) => {
			const existing = await deps.tracksRepository.findRowById(input.trackId, input.tenantId);
			if (!existing) {
				throw apiError(404, 'track_not_found', 'Track not found.');
			}

			return deps.tracksRepository.updateTrack({
				trackId: input.trackId,
				tenantId: input.tenantId,
				patch: input.input,
				now: now()
			});
		},

		setLyrics: async (input) => {
			const existing = await deps.tracksRepository.findRowById(input.trackId, input.tenantId);
			if (!existing) {
				throw apiError(404, 'track_not_found', 'Track not found.');
			}

			const lyricsStatus = parseLyricsStatus(input.input.lyricsLrc);

			return deps.tracksRepository.setLyrics({
				trackId: input.trackId,
				tenantId: input.tenantId,
				lyricsLrc: input.input.lyricsLrc,
				lyricsStatus,
				now: now()
			});
		},

		clearLyrics: async (trackId, tenantId) => {
			const existing = await deps.tracksRepository.findRowById(trackId, tenantId);
			if (!existing) {
				throw apiError(404, 'track_not_found', 'Track not found.');
			}

			return deps.tracksRepository.clearLyrics(trackId, tenantId, now());
		},

		softDeleteTrack: async (trackId, tenantId) => {
			const existing = await deps.tracksRepository.findRowById(trackId, tenantId);
			if (!existing) {
				throw apiError(404, 'track_not_found', 'Track not found.');
			}

			return deps.tracksRepository.softDelete(trackId, tenantId, now());
		},

		getStream: async (input) => {
			const track = await deps.tracksRepository.findRowById(input.trackId, input.tenantId);
			if (!track) {
				throw apiError(404, 'track_not_found', 'Track not found.');
			}

			if (track.status !== 'ready') {
				throw apiError(404, 'track_not_ready', 'Track is not ready for streaming.');
			}

			const r2Options: R2GetOptions = {};
			if (input.rangeHeader) {
				const parsed = parseRangeHeader(input.rangeHeader);
				if (parsed) {
					r2Options.range = parsed;
				}
			}

			const object = await deps.r2.get(track.audioR2Key, r2Options);
			if (!object) {
				throw apiError(404, 'track_not_found', 'Audio file not found.');
			}

			return object;
		}
	};
}

export function createTracksServiceForDb(db: Db, r2: R2Bucket): TracksService {
	return createTracksService({
		tracksRepository: createTracksRepository(db),
		r2
	});
}

function getExt(name: string): string {
	const i = name.lastIndexOf('.');
	return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function resolveContentType(file: UploadFile): string {
	if (SUPPORTED_MIME_TYPES.has(file.type)) return file.type;
	if (file.type && file.type !== 'application/octet-stream') {
		throw apiError(
			415,
			'unsupported_media_type',
			`Audio format ${file.type} is not supported.`
		);
	}
	const ext = getExt(file.name);
	if (ext in EXT_TO_MIME) return EXT_TO_MIME[ext]!;
	throw apiError(
		415,
		'unsupported_media_type',
		`Audio format ${file.type || 'unknown'} is not supported.`
	);
}

function deriveTitleFromFilename(filename: string): string {
	const dotIndex = filename.lastIndexOf('.');
	return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}

function parseRangeHeader(header: string): { offset: number; length?: number } | null {
	const match = header.match(/^bytes=(\d+)-(\d*)$/);
	if (!match) return null;
	const start = parseInt(match[1]!, 10);
	const endStr = match[2];
	if (endStr && endStr.length > 0) {
		const end = parseInt(endStr, 10);
		return { offset: start, length: end - start + 1 };
	}
	return { offset: start };
}

function parseLyricsStatus(lyricsLrc: string | null): LyricsStatus {
	if (!lyricsLrc || lyricsLrc.trim().length === 0) return 'none';

	const lrc = Lrc.parse(lyricsLrc);

	if (lrc.lyrics.length > 0) return 'synced';

	const metadataRe = /^\[[A-Za-z]+:[^\]]*\]$/;
	const lines = lyricsLrc.split('\n');
	let hasValidText = false;
	let hasBracketOnlyLines = false;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (line.length === 0) continue;
		if (metadataRe.test(line)) continue;

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
