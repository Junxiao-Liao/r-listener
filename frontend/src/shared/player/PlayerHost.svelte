<script lang="ts">
	import { onMount } from 'svelte';
	import { useSessionQuery } from '$shared/query/session.query';
	import {
		useQueueQuery,
		useUpdateQueueItemMutation
	} from '$shared/query/queue.query';
	import { usePlaybackEventsMutation } from '$shared/query/playback.query';
	import { createPlayer, type Player } from './player.svelte';
	import { setPlayerContext } from './player.context';
	import { trackArtistDisplay } from '$shared/artists/artists';

	type Props = {
		children: import('svelte').Snippet;
	};

	let { children }: Props = $props();

	const session = useSessionQuery();
	const queueQuery = useQueueQuery(() => !!$session.data?.activeTenantId);
	const updateQueueItem = useUpdateQueueItemMutation();
	const playbackEvents = usePlaybackEventsMutation();

	const player: Player = createPlayer({
		setCurrentItem: (itemId) => $updateQueueItem.mutateAsync({ itemId, isCurrent: true }),
		pushPlaybackEvents: (events) => $playbackEvents.mutate(events),
		beaconPlaybackEvents: (events) => {
			if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
			const blob = new Blob([JSON.stringify({ events })], {
				type: 'application/json'
			});
			navigator.sendBeacon('/api/playback-events', blob);
		}
	});

	setPlayerContext(player);

	let audioEl: HTMLAudioElement | undefined = $state();

	onMount(() => {
		if (!audioEl) return;
		const detach = player.attach(audioEl);
		return detach;
	});

	$effect(() => {
		if ($queueQuery.data) {
			player.setQueueState($queueQuery.data);
		}
	});

	$effect(() => {
		if ($session.data) {
			player.setAutoPlayNext($session.data.preferences.autoPlayNext);
		}
	});

	// Update Media Session metadata when track changes
	$effect(() => {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
		const track = player.currentTrack;
		if (track) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: track.title,
				artist: trackArtistDisplay(track),
				album: track.album ?? ''
			});
		} else {
			navigator.mediaSession.metadata = null;
		}
	});
</script>

<audio bind:this={audioEl} preload="metadata" class="hidden"></audio>
{@render children()}
