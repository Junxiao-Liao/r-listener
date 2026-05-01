<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatDurationMs } from '$shared/format/duration';
	import { trackArtistDisplay } from '$shared/artists/artists';
	import { getPlayer } from '$shared/player/player.context';
	import { usePlayListMutation } from '$shared/player/play-list';
	import TrackActions from '$shared/player/TrackActions.svelte';
	import type { TrackDto } from '$shared/types/dto';

	type Props = { track: TrackDto; siblings: TrackDto[] };
	let { track, siblings = [track] }: Props = $props();

	const player = getPlayer();
	const playList = usePlayListMutation();

	const subtitle = $derived(
		[trackArtistDisplay(track), track.album]
			.filter((v): v is string => !!v && v.length > 0)
			.join(' · ')
	);

	const playableSiblings = $derived(siblings.filter((t) => t.status === 'ready'));

	async function playFromVisibleList() {
		if (track.status !== 'ready') return;
		const state = await $playList.mutateAsync({
			tracks: playableSiblings.length > 0 ? playableSiblings : [track],
			startTrackId: track.id
		});
		player.setQueueState(state, { autoplay: true });
	}
</script>

<div class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted focus-within:bg-muted">
	<CoverPlaceholder seed={track.title} class="size-12 text-lg" />
	<button
		type="button"
		disabled={track.status !== 'ready' || $playList.isPending}
		class="flex min-w-0 flex-1 flex-col text-left disabled:cursor-not-allowed disabled:opacity-70"
		onclick={playFromVisibleList}
	>
		<span class="flex items-center gap-2 text-sm font-medium">
			<span class="truncate">{track.title}</span>
			{#if track.status === 'pending'}
				<span class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-700 dark:text-amber-300">
					{m.library_status_pending()}
				</span>
			{/if}
		</span>
		{#if subtitle.length > 0}
			<span class="truncate text-xs text-muted-foreground">{subtitle}</span>
		{/if}
	</button>
	<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
		{formatDurationMs(track.durationMs)}
	</span>
	<TrackActions {track} siblings={playableSiblings} />
</div>
