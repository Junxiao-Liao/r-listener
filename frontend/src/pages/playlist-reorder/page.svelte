<script lang="ts">
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { formatDurationMs } from '$shared/format/duration';
	import {
		useMovePlaylistTrackMutation,
		usePlaylistTracksQuery
	} from '$shared/query/playlists.query';
	import type { Id, PlaylistTrackDto } from '$shared/types/dto';

	type Props = { id: Id<'playlist'> };
	let { id }: Props = $props();

	type RowItem = PlaylistTrackDto & { _dndId: string };

	const tracks = usePlaylistTracksQuery(() => id);
	const move = useMovePlaylistTrackMutation(id);

	let rows = $state<RowItem[]>([]);
	let initialized = $state(false);

	$effect(() => {
		if (!initialized && $tracks.data) {
			rows = $tracks.data.items.map((it) => ({ ...it, _dndId: it.trackId }));
			initialized = true;
		}
	});

	function handleConsider(e: CustomEvent<DndEvent<RowItem>>) {
		rows = e.detail.items;
	}

	async function handleFinalize(e: CustomEvent<DndEvent<RowItem>>) {
		const next = e.detail.items;
		rows = next;

		// Send PATCH for each track whose new index differs from its prior position.
		for (let i = 0; i < next.length; i += 1) {
			const item = next[i]!;
			const newPosition = i + 1;
			if (item.position !== newPosition) {
				try {
					await $move.mutateAsync({ trackId: item.trackId, position: newPosition });
				} catch {
					// Swallow; the next refetch will re-sync UI to server truth.
				}
			}
		}

		// Pull authoritative positions from server.
		await $tracks.refetch();
		if ($tracks.data) {
			rows = $tracks.data.items.map((it) => ({ ...it, _dndId: it.trackId }));
		}
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.playlist_reorder_title()}</h1>
		<Button variant="outline" href={`/playlists/${id}`}>{m.playlist_reorder_done()}</Button>
	</header>

	<p class="text-xs text-muted-foreground">{m.playlist_reorder_hint()}</p>

	{#if $tracks.isPending}
		<p class="text-sm text-muted-foreground">{m.playlist_detail_loading()}</p>
	{:else if rows.length === 0}
		<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
			{m.playlist_detail_empty()}
		</p>
	{:else}
		<ul
			class="flex flex-col gap-1"
			use:dndzone={{ items: rows, flipDurationMs: 150, dropTargetStyle: {} }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each rows as item (item._dndId)}
				<li
					class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
				>
					<GripVertical class="size-4 cursor-grab text-muted-foreground" />
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-sm font-medium">{item.track.title}</span>
						<span class="truncate text-xs text-muted-foreground">
							{[item.track.artist, item.track.album].filter(Boolean).join(' · ')}
						</span>
					</span>
					<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
						{formatDurationMs(item.track.durationMs)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
