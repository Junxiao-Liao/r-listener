import { and, asc, eq, gt, isNull, like, or } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import { toArtistDto } from './artists.dto';
import { artists } from './artists.orm';
import type { ArtistDto, ListArtistsResult } from './artists.type';
import { artistNameKey } from './artists.util';

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

export function createArtistsRepository(db: Db): ArtistsRepository {
	return {
		listArtists: async (input) => {
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

			return {
				items: items.map(toArtistDto),
				nextCursor: nextItem ? encodeCursor({ id: nextItem.id, nameKey: nextItem.nameKey }) : null
			};
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
