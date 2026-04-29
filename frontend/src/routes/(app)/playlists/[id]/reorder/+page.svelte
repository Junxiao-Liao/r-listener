<script lang="ts">
	import { page } from '$app/state';
	import Page from '$pages/playlist-reorder/page.svelte';
	import type { Id } from '$shared/types/dto';

	const id = $derived(page.params.id as Id<'playlist'>);
</script>

<Page {id} />
