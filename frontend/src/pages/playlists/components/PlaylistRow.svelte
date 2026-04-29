<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import type { PlaylistDto } from '$shared/types/dto';

	type Props = { playlist: PlaylistDto };
	let { playlist }: Props = $props();

	const trackLabel = $derived(
		playlist.trackCount === 1
			? m.playlists_track_count_one()
			: m.playlists_track_count({ count: playlist.trackCount })
	);
</script>

<a
	href={`/playlists/${playlist.id}`}
	class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted focus-within:bg-muted"
>
	<CoverPlaceholder seed={playlist.name} class="size-12 text-lg" />
	<span class="flex min-w-0 flex-1 flex-col">
		<span class="truncate text-sm font-medium">{playlist.name}</span>
		<span class="truncate text-xs text-muted-foreground">{trackLabel}</span>
	</span>
</a>
