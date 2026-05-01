<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import type { ArtistDto } from '$shared/types/dto';

	type Props = { artist: ArtistDto };
	let { artist }: Props = $props();
</script>

<a
	href={`/artists/${artist.id}`}
	class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted focus-within:bg-muted"
>
	<CoverPlaceholder seed={artist.name} class="size-12 text-lg" />
	<span class="flex min-w-0 flex-1 flex-col">
		<span class="truncate text-sm font-medium">{artist.name}</span>
	</span>
</a>
