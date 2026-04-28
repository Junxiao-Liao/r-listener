import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { createId } from '../shared/id';
import { apiError } from '../http/api-error';
import type { CreateTrackInput, FinalizeTrackInput, LyricsInput, TrackQuery, UpdateTrackInput } from './tracks.dto';
import type { ListTracksResult, TracksRepository } from './tracks.repository';
import { createTracksRepository } from './tracks.repository';
import type { LyricsStatus, TrackDto } from './tracks.type';

const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB

const SUPPORTED_MIME_TYPES = new Set([
	'audio/mpeg',
	'audio/mp4',
	'audio/mp3',
	'audio/ogg',
	'audio/flac',
	'audio/wav',
	'audio/x-wav',
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
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/aac': 'aac',
	'audio/x-m4a': 'm4a',
	'audio/webm': 'webm'
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
			if (!SUPPORTED_MIME_TYPES.has(input.file.type)) {
				throw apiError(
					415,
					'unsupported_media_type',
					`Audio format ${input.file.type || 'unknown'} is not supported.`
				);
			}

			if (input.file.size > MAX_AUDIO_BYTES) {
				throw apiError(413, 'payload_too_large', 'Audio file exceeds maximum size of 100 MB.');
			}

			if (input.file.size === 0) {
				throw apiError(400, 'upload_missing', 'Audio file is empty.');
			}

			const trackId = createId('trk_') as Id<'track'>;
			const ext = MIME_TO_EXT[input.file.type] ?? 'bin';
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
				contentType: input.file.type,
				sizeBytes: input.file.size,
				audioR2Key: r2Key,
				now: now_
			});

			await deps.r2.put(r2Key, input.file.stream(), {
				httpMetadata: { contentType: input.file.type }
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
	if (!lyricsLrc || lyricsLrc.trim().length === 0) {
		return 'none';
	}

	const lines = lyricsLrc.split('\n');
	const lrcLineRegex = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/;
	let lrcLineCount = 0;
	let bracketLineCount = 0;
	let totalLines = 0;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (line.length === 0) continue;
		totalLines++;

		if (lrcLineRegex.test(line)) {
			lrcLineCount++;
		}

		if (/^\[.*\]/.test(line)) {
			bracketLineCount++;

			if (!lrcLineRegex.test(line)) {
				// Has brackets but doesn't match LRC timestamp format
				return 'invalid';
			}
		}
	}

	if (totalLines === 0) {
		return 'none';
	}

	if (lrcLineCount > 0 && lrcLineCount / totalLines >= 0.8) {
		return 'synced';
	}

	if (bracketLineCount > 0 && lrcLineCount / totalLines < 0.8) {
		return 'invalid';
	}

	return 'plain';
}
