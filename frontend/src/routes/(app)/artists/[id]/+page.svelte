<script lang="ts">
	import { page } from '$app/state';
	import ArtistDetailPage from '$pages/artist-detail/page.svelte';
	import type { Id } from '$shared/types/dto';

	const id = $derived(page.params.id as Id<'artist'>);
</script>

<ArtistDetailPage {id} />
