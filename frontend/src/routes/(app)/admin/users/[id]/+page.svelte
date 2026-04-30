<script lang="ts">
	import { page } from '$app/state';
	import Page from '$pages/admin/users/detail.svelte';
	import type { Id } from '$shared/types/dto';

	const userId = $derived(page.params.id as Id<'user'>);
</script>

<Page {userId} />
