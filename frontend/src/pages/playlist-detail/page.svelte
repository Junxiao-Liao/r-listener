<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import * as m from '$shared/paraglide/messages';
	import { isEditor } from '$shared/auth/role';
	import { Button } from '$shared/components/ui/button';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatDurationMs } from '$shared/format/duration';
	import {
		usePlaylistQuery,
		usePlaylistTracksQuery
	} from '$shared/query/playlists.query';
	import { useSessionQuery } from '$shared/query/session.query';
	import { usePlayListMutation } from '$shared/player/play-list';
	import { getPlayer } from '$shared/player/player.context';
	import type { Id } from '$shared/types/dto';
	import PlaylistTrackRow from './components/PlaylistTrackRow.svelte';

	type Props = { id: Id<'playlist'> };
	let { id }: Props = $props();

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));
	const playlist = usePlaylistQuery(() => id);
	const tracks = usePlaylistTracksQuery(() => id);
	const playList = usePlayListMutation();
	const player = getPlayer();

	const items = $derived($tracks.data?.items ?? []);
	const playableTracks = $derived(
		items.map((i) => i.track).filter((t) => t.status === 'ready')
	);

	async function playAll() {
		if (playableTracks.length === 0) return;
		const state = await $playList.mutateAsync({
			tracks: playableTracks,
			startTrackId: playableTracks[0]!.id
		});
		player.setQueueState(state, { autoplay: true });
	}
</script>

<section class="flex flex-col gap-4 py-6">
	{#if $playlist.isPending}
		<p class="text-sm text-muted-foreground">{m.playlist_detail_loading()}</p>
	{:else if $playlist.isError || !$playlist.data}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.playlist_detail_error()}
		</p>
	{:else}
		{@const p = $playlist.data}
		<header class="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:text-left">
			<CoverPlaceholder seed={p.name} class="size-32 text-3xl" />
			<div class="flex flex-1 flex-col gap-1">
				<h1 class="text-2xl font-semibold">{p.name}</h1>
				{#if p.description}
					<p class="text-sm text-muted-foreground">{p.description}</p>
				{/if}
				<p class="text-xs text-muted-foreground">
					{p.trackCount === 1
						? m.playlists_track_count_one()
						: m.playlists_track_count({ count: p.trackCount })}
					·
					{m.playlist_detail_total_duration({ duration: formatDurationMs(p.totalDurationMs) })}
				</p>
			</div>
		</header>

		<div class="flex flex-wrap gap-2">
			<Button onclick={playAll} disabled={playableTracks.length === 0 || $playList.isPending}>
				<Play class="size-4" />
				<span>{m.playlist_detail_play()}</span>
			</Button>
			{#if editor}
				<Button variant="outline" href={`/playlists/${id}/add-music`}>
					<Plus class="size-4" />
					<span>{m.playlist_detail_add_music()}</span>
				</Button>
				<Button variant="outline" href={`/playlists/${id}/reorder`}>
					<ArrowUpDown class="size-4" />
					<span>{m.playlist_detail_reorder()}</span>
				</Button>
				<Button variant="outline" href={`/playlists/${id}/edit`}>
					<Pencil class="size-4" />
					<span>{m.playlist_detail_edit()}</span>
				</Button>
			{/if}
		</div>

		{#if $tracks.isPending}
			<p class="text-sm text-muted-foreground">{m.playlist_detail_loading()}</p>
		{:else if items.length === 0}
			<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
				{m.playlist_detail_empty()}
			</p>
		{:else}
			<ul class="flex flex-col gap-1">
				{#each items as item (item.trackId)}
					<li>
						<PlaylistTrackRow {item} siblings={items} playlistId={id} />
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>
