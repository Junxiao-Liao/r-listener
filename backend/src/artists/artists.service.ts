import type { Db } from '../db';
import { apiError } from '../http/api-error';
import type { Id } from '../shared/shared.type';
import type { ArtistsQuery } from './artists.dto';
import { createArtistsRepository, type ArtistsRepository } from './artists.repository';
import type { ArtistAggregateDto, ArtistTrackListResult, ListArtistsResult } from './artists.type';

export type ArtistsService = {
	listArtists(input: { tenantId: Id<'tenant'>; query: ArtistsQuery }): Promise<ListArtistsResult>;
	getArtist(input: { tenantId: Id<'tenant'>; artistId: Id<'artist'> }): Promise<ArtistAggregateDto>;
	listArtistTracks(input: { tenantId: Id<'tenant'>; artistId: Id<'artist'> }): Promise<ArtistTrackListResult>;
};

export function createArtistsService(deps: { artistsRepository: ArtistsRepository }): ArtistsService {
	return {
		listArtists: (input) =>
			deps.artistsRepository.listArtists({
				tenantId: input.tenantId,
				q: input.query.q,
				cursor: input.query.cursor,
				limit: input.query.limit
			}),

		getArtist: async (input) => {
			const result = await deps.artistsRepository.findArtist({
				tenantId: input.tenantId,
				artistId: input.artistId
			});
			if (!result) throw apiError(404, 'artist_not_found', 'Artist not found.');
			return result;
		},

		listArtistTracks: async (input) => {
			const artist = await deps.artistsRepository.findArtist({
				tenantId: input.tenantId,
				artistId: input.artistId
			});
			if (!artist) throw apiError(404, 'artist_not_found', 'Artist not found.');
			return deps.artistsRepository.listArtistTracks({
				tenantId: input.tenantId,
				artistId: input.artistId
			});
		}
	};
}

export function createArtistsServiceForDb(db: Db): ArtistsService {
	return createArtistsService({ artistsRepository: createArtistsRepository(db) });
}
