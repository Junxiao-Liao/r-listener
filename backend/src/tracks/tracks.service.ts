import type { TracksRepository } from './tracks.repository';

export type TracksService = {
	readonly tracksRepository: TracksRepository;
};

export function createTracksService(tracksRepository: TracksRepository): TracksService {
	return { tracksRepository };
}
