import type {
	Id,
	Iso8601,
	PlaybackEventInput,
	PlaybackEventKind,
	QueueItemDto,
	QueueStateDto,
	TrackDto
} from '$shared/types/dto';

const FLUSH_INTERVAL_MS = 15_000;

export type PlayerCallbacks = {
	setCurrentItem: (itemId: Id<'queue_item'>) => Promise<unknown> | void;
	pushPlaybackEvents: (events: PlaybackEventInput[]) => void;
	beaconPlaybackEvents: (events: PlaybackEventInput[]) => void;
};

export type Player = {
	readonly queue: QueueItemDto[];
	readonly currentItemId: Id<'queue_item'> | null;
	readonly currentItem: QueueItemDto | null;
	readonly currentTrack: TrackDto | null;
	readonly isPlaying: boolean;
	readonly currentTimeMs: number;
	readonly durationMs: number;
	attach(audioEl: HTMLAudioElement): () => void;
	setQueueState(state: QueueStateDto, options?: { autoplay?: boolean }): void;
	setAutoPlayNext(v: boolean): void;
	play(): void;
	pause(): void;
	togglePlay(): void;
	seek(ms: number): void;
	next(): void;
	prev(): void;
};

export function createPlayer(callbacks: PlayerCallbacks): Player {
	let audioEl: HTMLAudioElement | null = null;
	let queue = $state<QueueItemDto[]>([]);
	let currentItemId = $state<Id<'queue_item'> | null>(null);
	let isPlaying = $state(false);
	let currentTimeMs = $state(0);
	let durationMs = $state(0);
	let pendingAutoplayItemId: Id<'queue_item'> | null = null;

	let buffer: PlaybackEventInput[] = [];
	let lastProgressBufferedAt = 0;
	let flushTimer: ReturnType<typeof setInterval> | null = null;
	let detachers: Array<() => void> = [];

	const currentItem = $derived<QueueItemDto | null>(
		queue.find((q) => q.id === currentItemId) ?? null
	);
	const currentTrack = $derived<TrackDto | null>(currentItem?.track ?? null);

	function bufferEvent(kind: PlaybackEventKind, positionMs: number) {
		const track = currentItem?.track;
		if (!track) return;
		buffer.push({
			trackId: track.id,
			startedAt: new Date().toISOString() as Iso8601,
			positionMs: Math.max(0, Math.floor(positionMs)),
			event: kind,
			playlistId: null
		});
	}

	function flush(synchronous = false) {
		if (buffer.length === 0) return;
		const events = buffer;
		buffer = [];
		if (synchronous) callbacks.beaconPlaybackEvents(events);
		else callbacks.pushPlaybackEvents(events);
	}

	function streamUrlFor(trackId: Id<'track'>) {
		return `/api/tracks/${trackId}/stream`;
	}

	function loadCurrentTrackIntoAudio(autoplay: boolean) {
		if (!audioEl) return;
		const track = currentItem?.track;
		if (!track) {
			audioEl.removeAttribute('src');
			audioEl.load();
			return;
		}
		const desired = streamUrlFor(track.id);
		if (audioEl.dataset.trackId !== track.id) {
			audioEl.dataset.trackId = track.id;
			audioEl.src = desired;
			audioEl.load();
			if (autoplay) {
				audioEl.play().catch(() => {});
			}
		}
	}

	function advance(direction: 1 | -1, wrap: boolean) {
		if (queue.length === 0) return;
		const idx = currentItemId ? queue.findIndex((q) => q.id === currentItemId) : -1;
		let next = idx + direction;
		if (wrap) {
			next = ((next % queue.length) + queue.length) % queue.length;
		} else if (next < 0 || next >= queue.length) {
			return;
		}
		const target = queue[next];
		if (!target) return;
		pendingAutoplayItemId = target.id;
		void callbacks.setCurrentItem(target.id);
	}

	function attach(el: HTMLAudioElement): () => void {
		audioEl = el;

		const onPlay = () => {
			isPlaying = true;
			bufferEvent('play', el.currentTime * 1000);
			if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
				navigator.mediaSession.playbackState = 'playing';
			}
		};
		const onPause = () => {
			isPlaying = false;
			bufferEvent('progress', el.currentTime * 1000);
			flush();
			if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
				navigator.mediaSession.playbackState = 'paused';
			}
		};
		const onTimeUpdate = () => {
			currentTimeMs = el.currentTime * 1000;
			const now = Date.now();
			if (!el.paused && now - lastProgressBufferedAt > FLUSH_INTERVAL_MS) {
				bufferEvent('progress', el.currentTime * 1000);
				lastProgressBufferedAt = now;
				flush();
			}
		};
		const onDurationChange = () => {
			durationMs = isFinite(el.duration) ? el.duration * 1000 : 0;
		};
		const onEnded = () => {
			isPlaying = false;
			const trackDuration = currentItem?.track.durationMs ?? Math.floor(el.currentTime * 1000);
			bufferEvent('ended', trackDuration);
			flush();
			// Always advance, wrapping to the first item at the end.
			advance(1, true);
		};
		const onError = () => {
			if (!audioEl || !currentItem) return;
			// Reload once on error
			audioEl.dataset.trackId = '';
			loadCurrentTrackIntoAudio(true);
		};

		el.addEventListener('play', onPlay);
		el.addEventListener('pause', onPause);
		el.addEventListener('timeupdate', onTimeUpdate);
		el.addEventListener('durationchange', onDurationChange);
		el.addEventListener('loadedmetadata', onDurationChange);
		el.addEventListener('ended', onEnded);
		el.addEventListener('error', onError);

		flushTimer = setInterval(() => {
			if (audioEl && !audioEl.paused) flush();
		}, FLUSH_INTERVAL_MS);

		const onPageHide = () => flush(true);
		const onVisibilityChange = () => {
			if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flush(true);
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('pagehide', onPageHide);
		}
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', onVisibilityChange);
		}

		// Media session handlers
		if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
			navigator.mediaSession.setActionHandler('play', () => play());
			navigator.mediaSession.setActionHandler('pause', () => pause());
			navigator.mediaSession.setActionHandler('previoustrack', () => prev());
			navigator.mediaSession.setActionHandler('nexttrack', () => next());
			navigator.mediaSession.setActionHandler('seekto', (details) => {
				if (typeof details.seekTime === 'number') seek(details.seekTime * 1000);
			});
		}

		// Run-once detach
		detachers = [
			() => {
				el.removeEventListener('play', onPlay);
				el.removeEventListener('pause', onPause);
				el.removeEventListener('timeupdate', onTimeUpdate);
				el.removeEventListener('durationchange', onDurationChange);
				el.removeEventListener('loadedmetadata', onDurationChange);
				el.removeEventListener('ended', onEnded);
				el.removeEventListener('error', onError);
			},
			() => {
				if (flushTimer) clearInterval(flushTimer);
				flushTimer = null;
			},
			() => {
				if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
				if (typeof document !== 'undefined')
					document.removeEventListener('visibilitychange', onVisibilityChange);
			}
		];

		// Load any track that was set before attach
		loadCurrentTrackIntoAudio(false);

		return () => {
			for (const d of detachers) d();
			detachers = [];
			audioEl = null;
		};
	}

	function setQueueState(state: QueueStateDto, options: { autoplay?: boolean } = {}) {
		const previousItemId = currentItemId;
		queue = state.items;
		const currentChanged = state.currentItemId !== previousItemId;
		const shouldAutoplay =
			options.autoplay === true ||
			(!!state.currentItemId && pendingAutoplayItemId === state.currentItemId);
		pendingAutoplayItemId = null;

		if (currentChanged) {
			currentItemId = state.currentItemId;
			loadCurrentTrackIntoAudio(shouldAutoplay);
		} else if (audioEl && currentItem && audioEl.dataset.trackId !== currentItem.track.id) {
			loadCurrentTrackIntoAudio(shouldAutoplay);
		}
	}

	function setAutoPlayNext(_v: boolean) {
		// The current product decision is to always advance; keep the setter for the
		// existing preferences UI without letting it disable queue progression.
	}

	function play() {
		if (audioEl && currentTrack && audioEl.dataset.trackId !== currentTrack.id) {
			loadCurrentTrackIntoAudio(true);
		}
		audioEl?.play().catch(() => {});
	}
	function pause() {
		audioEl?.pause();
	}
	function togglePlay() {
		if (isPlaying) pause();
		else play();
	}
	function seek(ms: number) {
		if (!audioEl) return;
		bufferEvent('progress', audioEl.currentTime * 1000);
		flush();
		audioEl.currentTime = Math.max(0, ms / 1000);
		currentTimeMs = ms;
	}
	function next() {
		advance(1, true);
	}
	function prev() {
		if (audioEl && audioEl.currentTime > 3) {
			audioEl.currentTime = 0;
			currentTimeMs = 0;
			return;
		}
		advance(-1, true);
	}

	return {
		get queue() {
			return queue;
		},
		get currentItemId() {
			return currentItemId;
		},
		get currentItem() {
			return currentItem;
		},
		get currentTrack() {
			return currentTrack;
		},
		get isPlaying() {
			return isPlaying;
		},
		get currentTimeMs() {
			return currentTimeMs;
		},
		get durationMs() {
			return durationMs;
		},
		attach,
		setQueueState,
		setAutoPlayNext,
		play,
		pause,
		togglePlay,
		seek,
		next,
		prev
	};
}
