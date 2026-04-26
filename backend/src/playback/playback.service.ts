import type { PlaybackRepository } from './playback.repository';

export type PlaybackService = {
	readonly playbackRepository: PlaybackRepository;
};

export function createPlaybackService(playbackRepository: PlaybackRepository): PlaybackService {
	return { playbackRepository };
}
