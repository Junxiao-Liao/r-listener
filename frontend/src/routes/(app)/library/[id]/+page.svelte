<script lang="ts">
	import { page } from '$app/state';
	import Page from '$pages/music-detail/page.svelte';
	import type { Id } from '$shared/types/dto';

	const trackId = $derived(page.params.id as Id<'track'>);
</script>

<Page {trackId} />
