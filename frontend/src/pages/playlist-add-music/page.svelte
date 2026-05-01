<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatDurationMs } from '$shared/format/duration';
	import { trackArtistDisplay } from '$shared/artists/artists';
	import { useTracksInfiniteQuery } from '$shared/query/tracks.query';
	import {
		useAddPlaylistTrackMutation,
		usePlaylistTracksQuery
	} from '$shared/query/playlists.query';
	import type { Id } from '$shared/types/dto';

	type Props = { id: Id<'playlist'> };
	let { id }: Props = $props();

	let q = $state('');
	const tracks = useTracksInfiniteQuery(() => ({
		sort: 'createdAt:desc',
		q: q.trim() || undefined
	}));
	const existing = usePlaylistTracksQuery(() => id);
	const addTrack = useAddPlaylistTrackMutation(id);

	const items = $derived($tracks.data?.pages.flatMap((p) => p.items) ?? []);
	const existingIds = $derived(
		new Set(($existing.data?.items ?? []).map((i) => i.trackId))
	);

	let selected = $state(new Set<Id<'track'>>());
	const selectedCount = $derived(selected.size);

	function toggle(trackId: Id<'track'>) {
		if (existingIds.has(trackId)) return;
		const next = new Set(selected);
		if (next.has(trackId)) next.delete(trackId);
		else next.add(trackId);
		selected = next;
	}

	let saving = $state(false);

	async function addSelected() {
		if (selected.size === 0) return;
		saving = true;
		try {
			for (const trackId of selected) {
				await $addTrack.mutateAsync({ trackId, position: null });
			}
			void goto(`/playlists/${id}`);
		} finally {
			saving = false;
		}
	}
</script>

<section class="flex flex-col gap-4 py-6 pb-24">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.playlist_add_music_title()}</h1>
		<Button variant="outline" href={`/playlists/${id}`}>{m.playlist_create_cancel()}</Button>
	</header>

	<Input
		type="search"
		placeholder={m.playlist_add_music_search()}
		bind:value={q}
		class="max-w-md"
	/>

	{#if $tracks.isPending}
		<p class="text-sm text-muted-foreground">{m.playlists_loading()}</p>
	{:else if $tracks.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.playlist_add_music_error()}
		</p>
	{:else if items.length === 0}
		<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
			{q.trim() ? m.playlist_add_music_empty() : m.playlist_add_music_no_library()}
		</p>
	{:else}
		<ul class="flex flex-col gap-1">
			{#each items as track (track.id)}
				{@const already = existingIds.has(track.id)}
				{@const checked = selected.has(track.id)}
				<li>
					<label
						class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60"
					>
						<input
							type="checkbox"
							checked={checked}
							disabled={already || track.status !== 'ready'}
							onchange={() => toggle(track.id)}
							class="size-4"
						/>
						<CoverPlaceholder seed={track.title} class="size-10 text-base" />
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm font-medium">{track.title}</span>
							<span class="truncate text-xs text-muted-foreground">
								{[trackArtistDisplay(track), track.album].filter(Boolean).join(' · ')}
							</span>
						</span>
						<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
							{formatDurationMs(track.durationMs)}
						</span>
						{#if already}
							<span class="shrink-0 text-xs text-muted-foreground">
								{m.playlist_add_music_already_added()}
							</span>
						{/if}
					</label>
				</li>
			{/each}
		</ul>
		{#if $tracks.hasNextPage}
			<div class="flex justify-center pt-2">
				<Button
					variant="outline"
					disabled={$tracks.isFetchingNextPage}
					onclick={() => $tracks.fetchNextPage()}
				>
					{$tracks.isFetchingNextPage ? m.playlists_loading() : m.library_load_more()}
				</Button>
			</div>
		{/if}
	{/if}
</section>

{#if selectedCount > 0}
	<div
		class="fixed inset-x-0 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 border-t border-border bg-background px-4 py-3 shadow-lg"
		style="bottom: calc(var(--bottom-nav-h, 0px) + var(--mini-player-h, 0px) + env(safe-area-inset-bottom, 0px));"
	>
		<span class="text-sm">{m.playlist_add_music_selected({ count: selectedCount })}</span>
		<Button onclick={addSelected} disabled={saving}>
			{m.playlist_add_music_add_selected()}
		</Button>
	</div>
{/if}
