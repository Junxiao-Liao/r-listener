<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ListPlus from '@lucide/svelte/icons/list-plus';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatDurationMs } from '$shared/format/duration';
	import { useArtistQuery, useArtistTracksQuery } from '$shared/query/artists.query';
	import { useAddQueueItemsMutation } from '$shared/query/queue.query';
	import { usePlayListMutation } from '$shared/player/play-list';
	import { getPlayer } from '$shared/player/player.context';
	import type { Id } from '$shared/types/dto';
	import AddToPlaylistSheet from '$shared/player/AddToPlaylistSheet.svelte';
	import ArtistTrackRow from './components/ArtistTrackRow.svelte';

	type Props = { id: Id<'artist'> };
	let { id }: Props = $props();

	const artist = useArtistQuery(() => id);
	const tracks = useArtistTracksQuery(() => id);
	const playList = usePlayListMutation();
	const addItems = useAddQueueItemsMutation();
	const player = getPlayer();

	let showPlaylistSheet = $state(false);
	let playlistTrackId = $state<Id<'track'> | null>(null);

	const items = $derived($tracks.data?.items ?? []);
	const playableTracks = $derived(
		items.filter((t) => t.status === 'ready')
	);

	async function playAll() {
		if (playableTracks.length === 0) return;
		const state = await $playList.mutateAsync({
			tracks: playableTracks,
			startTrackId: playableTracks[0]!.id
		});
		player.setQueueState(state, { autoplay: true });
	}

	async function addAllToQueue() {
		if (playableTracks.length === 0) return;
		await $addItems.mutateAsync({
			trackIds: playableTracks.map((t) => t.id)
		});
	}

	function addAllToPlaylist() {
		if (playableTracks.length === 0) return;
		playlistTrackId = playableTracks[0]!.id;
		showPlaylistSheet = true;
	}
</script>

<section class="flex flex-col gap-4 py-6">
	{#if $artist.isPending}
		<p class="text-sm text-muted-foreground">{m.artists_loading()}</p>
	{:else if $artist.isError || !$artist.data}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.artists_error()}
		</p>
	{:else}
		{@const a = $artist.data}
		<header class="flex flex-col items-start gap-4">
			<Button variant="ghost" class="-ml-2 text-muted-foreground" href="/artists">
				<ArrowLeft class="mr-2 size-4" />
				<span>{m.nav_artists()}</span>
			</Button>
			<div class="flex w-full flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:text-left">
			<CoverPlaceholder seed={a.name} class="size-32 text-3xl" />
			<div class="flex flex-1 flex-col gap-1">
				<h1 class="min-w-0 truncate text-2xl font-semibold">{a.name}</h1>
				<p class="text-xs text-muted-foreground">
					{a.trackCount === 1
						? m.playlists_track_count_one()
						: m.artist_track_count({ count: a.trackCount })}
					{a.trackCount > 0 ? ' · ' : ''}
					{a.trackCount > 0 ? m.artist_total_duration({ duration: formatDurationMs(a.totalDurationMs) }) : ''}
				</p>
			</div>
			</div>
		</header>

		<div class="flex flex-wrap gap-2">
			<Button onclick={playAll} disabled={playableTracks.length === 0 || $playList.isPending}>
				<Play class="size-4" />
				<span>{m.artist_play_all()}</span>
			</Button>
			<Button
				variant="outline"
				onclick={addAllToQueue}
				disabled={playableTracks.length === 0 || $addItems.isPending}
			>
				<ListPlus class="size-4" />
				<span>{m.artist_add_to_queue()}</span>
			</Button>
			<Button
				variant="outline"
				onclick={addAllToPlaylist}
				disabled={playableTracks.length === 0}
			>
				<ListMusic class="size-4" />
				<span>{m.artist_add_to_playlist()}</span>
			</Button>
		</div>

		{#if $tracks.isPending}
			<p class="text-sm text-muted-foreground">{m.artists_loading()}</p>
		{:else if $tracks.isError}
			<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{m.artists_error()}
			</p>
		{:else if items.length === 0}
			<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
				{m.artists_empty()}
			</p>
		{:else}
			<ul class="flex flex-col gap-1">
				{#each items as track (track.id)}
					<li>
						<ArtistTrackRow {track} siblings={playableTracks} />
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>

{#if showPlaylistSheet && playlistTrackId}
	<AddToPlaylistSheet
		trackId={playlistTrackId}
		trackIds={playableTracks.map((t) => t.id)}
		onclose={() => (showPlaylistSheet = false)}
	/>
{/if}
