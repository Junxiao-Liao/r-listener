import type { PlaylistsRepository } from './playlists.repository';

export type PlaylistsService = {
	readonly playlistsRepository: PlaylistsRepository;
};

export function createPlaylistsService(playlistsRepository: PlaylistsRepository): PlaylistsService {
	return { playlistsRepository };
}
