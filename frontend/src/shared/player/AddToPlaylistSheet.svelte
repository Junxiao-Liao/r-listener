<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$shared/components/ui/button';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { api, ApiError } from '$shared/api/client';
	import { queryKeys } from '$shared/query/keys';
	import { usePlaylistsQuery } from '$shared/query/playlists.query';
	import type { Id, PlaylistDto, PlaylistTrackDto } from '$shared/types/dto';

	type Props = {
		trackId: Id<'track'>;
		onclose: () => void;
	};

	let { trackId, onclose }: Props = $props();

	const qc = useQueryClient();
	const playlists = usePlaylistsQuery(() => ({ sort: 'updatedAt:desc' }));
	const items = $derived($playlists.data?.items ?? []);

	let pendingId = $state<string | null>(null);
	let alreadyIds = $state(new Set<string>());
	let addedIds = $state(new Set<string>());

	async function addTo(playlist: PlaylistDto) {
		pendingId = playlist.id;
		try {
			await api<PlaylistTrackDto>(`/playlists/${playlist.id}/tracks`, {
				method: 'POST',
				body: { trackId, position: null }
			});
			addedIds = new Set([...addedIds, playlist.id]);
			void qc.invalidateQueries({ queryKey: queryKeys.playlist(playlist.id) });
			void qc.invalidateQueries({ queryKey: queryKeys.playlistTracks(playlist.id) });
			void qc.invalidateQueries({ queryKey: queryKeys.playlists });
		} catch (err) {
			if (err instanceof ApiError && err.code === 'track_already_in_playlist') {
				alreadyIds = new Set([...alreadyIds, playlist.id]);
				return;
			}
			throw err;
		} finally {
			pendingId = null;
		}
	}
</script>

<div
	class="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
	role="presentation"
	onclick={onclose}
>
	<div
		class="w-full max-w-md rounded-t-2xl border border-border bg-background p-4 shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-label={m.playlist_picker_title()}
		onclick={(e) => e.stopPropagation()}
	>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">{m.playlist_picker_title()}</h2>
			<Button variant="outline" onclick={onclose}>{m.playlist_create_cancel()}</Button>
		</div>

		{#if $playlists.isPending}
			<p class="text-sm text-muted-foreground">{m.playlists_loading()}</p>
		{:else if items.length === 0}
			<div class="flex flex-col gap-2 py-4 text-center">
				<p class="text-sm text-muted-foreground">{m.playlist_picker_empty()}</p>
				<Button href="/playlists/new" onclick={onclose}>
					{m.playlist_picker_create()}
				</Button>
			</div>
		{:else}
			<ul class="max-h-[60vh] overflow-y-auto">
				{#each items as p (p.id)}
					{@const already = alreadyIds.has(p.id)}
					{@const added = addedIds.has(p.id)}
					{@const pending = pendingId === p.id}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
							disabled={pending || added || already}
							onclick={() => addTo(p)}
						>
							<CoverPlaceholder seed={p.name} class="size-10 text-base" />
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="truncate text-sm font-medium">{p.name}</span>
								<span class="truncate text-xs text-muted-foreground">
									{p.trackCount === 1
										? m.playlists_track_count_one()
										: m.playlists_track_count({ count: p.trackCount })}
								</span>
							</span>
							{#if added}
								<span class="text-xs text-muted-foreground">{m.playlist_picker_added()}</span>
							{:else if already}
								<span class="text-xs text-muted-foreground">{m.playlist_picker_already_added()}</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
