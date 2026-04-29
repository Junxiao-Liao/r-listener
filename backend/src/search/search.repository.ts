import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { toPlaylistDto } from '../playlists/playlists.dto';
import { playlistTracks, playlists } from '../playlists/playlists.orm';
import type { PlaylistDto } from '../playlists/playlists.type';
import { toTrackDto } from '../tracks/tracks.dto';
import { tracks } from '../tracks/tracks.orm';
import type { TrackDto, TrackStatus } from '../tracks/tracks.type';
import type { SearchHitDto, SearchKind, SearchResultDto } from './search.type';

export type SearchRepository = {
	search(input: SearchRepositoryInput): Promise<SearchResultDto>;
};

export type SearchRepositoryInput = {
	tenantId: Id<'tenant'>;
	q: string;
	limit: number;
	cursor?: string | undefined;
	kinds: SearchKind[];
};

export type SearchCandidate =
	| {
			kind: 'track';
			tenantId: Id<'tenant'>;
			status: TrackStatus;
			deletedAt: Date | null;
			updatedAt: Date;
			primaryText: string;
			texts: Array<string | null>;
			hit: Extract<SearchHitDto, { kind: 'track' }>;
	  }
	| {
			kind: 'playlist';
			tenantId: Id<'tenant'>;
			deletedAt: Date | null;
			updatedAt: Date;
			primaryText: string;
			texts: Array<string | null>;
			hit: Extract<SearchHitDto, { kind: 'playlist' }>;
	  };

export function createSearchRepository(db: Db): SearchRepository {
	async function playlistAggregate(playlistId: string): Promise<{
		trackCount: number;
		totalDurationMs: number;
	}> {
		const rows = await db
			.select({
				count: sql<number>`COUNT(${tracks.id})`,
				total: sql<number>`COALESCE(SUM(${tracks.durationMs}), 0)`
			})
			.from(playlistTracks)
			.innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
			.where(
				and(
					eq(playlistTracks.playlistId, playlistId),
					isNull(playlistTracks.deletedAt),
					eq(tracks.status, 'ready' satisfies TrackStatus),
					isNull(tracks.deletedAt)
				)
			);
		const r = rows[0];
		return {
			trackCount: Number(r?.count ?? 0),
			totalDurationMs: Number(r?.total ?? 0)
		};
	}

	async function searchTracks(input: SearchRepositoryInput): Promise<SearchCandidate[]> {
		if (!input.kinds.includes('track')) return [];
		const pattern = `%${escapeLike(input.q.toLowerCase())}%`;
		const rows = await db
			.select()
			.from(tracks)
			.where(
				and(
					eq(tracks.tenantId, input.tenantId),
					eq(tracks.status, 'ready' satisfies TrackStatus),
					isNull(tracks.deletedAt),
					sql`(
						lower(${tracks.title}) LIKE ${pattern} ESCAPE '\\'
						OR lower(${tracks.artist}) LIKE ${pattern} ESCAPE '\\'
						OR lower(${tracks.album}) LIKE ${pattern} ESCAPE '\\'
					)`
				)
			);

		return rows.map((track) => {
			const dto = toTrackDto(track, null);
			return {
				kind: 'track',
				tenantId: dto.tenantId,
				status: dto.status,
				deletedAt: track.deletedAt,
				updatedAt: toDate(track.updatedAt),
				primaryText: dto.title,
				texts: [dto.title, dto.artist, dto.album],
				hit: { kind: 'track', track: dto }
			};
		});
	}

	async function searchPlaylists(input: SearchRepositoryInput): Promise<SearchCandidate[]> {
		if (!input.kinds.includes('playlist')) return [];
		const pattern = `%${escapeLike(input.q.toLowerCase())}%`;
		const rows = await db
			.select()
			.from(playlists)
			.where(
				and(
					eq(playlists.tenantId, input.tenantId),
					isNull(playlists.deletedAt),
					sql`(
						lower(${playlists.name}) LIKE ${pattern} ESCAPE '\\'
						OR lower(${playlists.description}) LIKE ${pattern} ESCAPE '\\'
					)`
				)
			);

		const candidates: SearchCandidate[] = [];
		for (const playlist of rows) {
			const agg = await playlistAggregate(playlist.id);
			const dto = toPlaylistDto(playlist, agg.trackCount, agg.totalDurationMs);
			candidates.push({
				kind: 'playlist',
				tenantId: dto.tenantId,
				deletedAt: playlist.deletedAt,
				updatedAt: toDate(playlist.updatedAt),
				primaryText: dto.name,
				texts: [dto.name, dto.description],
				hit: { kind: 'playlist', playlist: dto }
			});
		}
		return candidates;
	}

	return {
		search: async (input) => {
			const candidates = [
				...(await searchTracks(input)),
				...(await searchPlaylists(input))
			];
			return rankSearchCandidates({ ...input, candidates });
		}
	};
}

export type RankSearchCandidatesInput = SearchRepositoryInput & {
	candidates: SearchCandidate[];
};

export function rankSearchCandidates(input: RankSearchCandidatesInput): SearchResultDto {
	const q = input.q.trim().toLowerCase();
	const offset = input.cursor ? decodeCursor(input.cursor).offset : 0;
	const ranked = input.candidates
		.filter((candidate) => isVisibleCandidate(candidate, input.tenantId, input.kinds))
		.map((candidate) => ({ candidate, rank: matchRank(candidate, q) }))
		.filter((item): item is { candidate: SearchCandidate; rank: number } => item.rank !== null)
		.sort((a, b) => {
			if (a.rank !== b.rank) return a.rank - b.rank;
			const timeDiff = b.candidate.updatedAt.getTime() - a.candidate.updatedAt.getTime();
			if (timeDiff !== 0) return timeDiff;
			if (a.candidate.kind !== b.candidate.kind) return a.candidate.kind.localeCompare(b.candidate.kind);
			return hitId(a.candidate.hit).localeCompare(hitId(b.candidate.hit));
		});

	const page = ranked.slice(offset, offset + input.limit);
	const nextOffset = offset + input.limit;

	return {
		items: page.map((item) => item.candidate.hit),
		nextCursor: nextOffset < ranked.length ? encodeCursor({ offset: nextOffset }) : null
	};
}

function isVisibleCandidate(
	candidate: SearchCandidate,
	tenantId: Id<'tenant'>,
	kinds: SearchKind[]
): boolean {
	if (!kinds.includes(candidate.kind)) return false;
	if (candidate.tenantId !== tenantId) return false;
	if (candidate.deletedAt !== null) return false;
	if (candidate.kind === 'track' && candidate.status !== 'ready') return false;
	return true;
}

function matchRank(candidate: SearchCandidate, q: string): number | null {
	if (!q) return null;
	const texts = candidate.texts
		.filter((value): value is string => !!value)
		.map((value) => value.toLowerCase());
	const primary = candidate.primaryText.toLowerCase();
	if (primary.startsWith(q)) return 0;
	if (texts.some((value) => value.startsWith(q))) return 1;
	if (texts.some((value) => value.includes(q))) return 2;
	return null;
}

function hitId(hit: SearchHitDto): string {
	return hit.kind === 'track' ? hit.track.id : hit.playlist.id;
}

function encodeCursor(data: { offset: number }): string {
	return btoa(JSON.stringify(data));
}

function decodeCursor(cursor: string): { offset: number } {
	try {
		const data = JSON.parse(atob(cursor)) as { offset?: unknown };
		return typeof data.offset === 'number' && data.offset >= 0 ? { offset: data.offset } : { offset: 0 };
	} catch {
		return { offset: 0 };
	}
}

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toDate(value: Date | number): Date {
	return value instanceof Date ? value : new Date(value * 1000);
}
