import type { Id } from '../shared/shared.type';

export type ArtistDto = {
	id: Id<'artist'>;
	name: string;
};

export type ListArtistsResult = {
	items: ArtistDto[];
	nextCursor: string | null;
};
