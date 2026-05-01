import { and, asc, eq, gt, isNull, like, or } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { toArtistDto } from './artists.dto';
import { artists } from './artists.orm';
import type { ArtistDto, ListArtistsResult } from './artists.type';
import { artistNameKey } from './artists.util';
import { cacheKey, createKvCache, KV_TTL } from '../lib/kv-cache';

type CursorData = { id: string; nameKey: string };

export type ListArtistsInput = {
	tenantId: Id<'tenant'>;
	q?: string | undefined;
	cursor?: string | undefined;
	limit: number;
};

export type ArtistsRepository = {
	listArtists(input: ListArtistsInput): Promise<ListArtistsResult>;
};

export function createArtistsRepository(db: Db, kv?: KVNamespace): ArtistsRepository {
	const cache = kv ? createKvCache(kv, { defaultTtlSeconds: KV_TTL.mutable }) : null;

	return {
		listArtists: async (input) => {
			const key = cacheKey('cache:artists:list', input.tenantId, {
				cursor: input.cursor,
				limit: input.limit,
				q: input.q
			});
			const cached = await cache?.tryGet<ListArtistsResult>(key);
			if (cached) return cached;

			const conditions = [eq(artists.tenantId, input.tenantId), isNull(artists.deletedAt)];

			if (input.q && input.q.trim().length > 0) {
				conditions.push(like(artists.nameKey, `%${artistNameKey(input.q)}%`));
			}

			if (input.cursor) {
				const cursor = decodeCursor(input.cursor);
				conditions.push(
					or(
						gt(artists.nameKey, cursor.nameKey),
						and(eq(artists.nameKey, cursor.nameKey), gt(artists.id, cursor.id))!
					)!
				);
			}

			const rows = await db
				.select()
				.from(artists)
				.where(and(...conditions))
				.orderBy(asc(artists.nameKey), asc(artists.id))
				.limit(input.limit + 1);

			const items = rows.slice(0, input.limit);
			const nextItem = rows.length > input.limit ? items.at(-1) : null;

			const result = {
				items: items.map(toArtistDto),
				nextCursor: nextItem ? encodeCursor({ id: nextItem.id, nameKey: nextItem.nameKey }) : null
			};
			await cache?.put(key, result);
			return result;
		}
	};
}

function encodeCursor(data: CursorData): string {
	return btoa(JSON.stringify(data));
}

function decodeCursor(cursor: string): CursorData {
	try {
		const data = JSON.parse(atob(cursor)) as Partial<CursorData>;
		return {
			id: typeof data.id === 'string' ? data.id : '',
			nameKey: typeof data.nameKey === 'string' ? data.nameKey : ''
		};
	} catch {
		return { id: '', nameKey: '' };
	}
}
