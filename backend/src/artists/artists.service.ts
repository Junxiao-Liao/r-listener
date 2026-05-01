import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import type { ArtistsQuery } from './artists.dto';
import { createArtistsRepository, type ArtistsRepository } from './artists.repository';
import type { ListArtistsResult } from './artists.type';

export type ArtistsService = {
	listArtists(input: { tenantId: Id<'tenant'>; query: ArtistsQuery }): Promise<ListArtistsResult>;
};

export function createArtistsService(deps: { artistsRepository: ArtistsRepository }): ArtistsService {
	return {
		listArtists: (input) =>
			deps.artistsRepository.listArtists({
				tenantId: input.tenantId,
				q: input.query.q,
				cursor: input.query.cursor,
				limit: input.query.limit
			})
	};
}

export function createArtistsServiceForDb(db: Db): ArtistsService {
	return createArtistsService({ artistsRepository: createArtistsRepository(db) });
}
