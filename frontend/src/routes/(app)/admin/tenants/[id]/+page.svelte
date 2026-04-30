<script lang="ts">
	import { page } from '$app/state';
	import Page from '$pages/admin/tenants/detail.svelte';
	import type { Id } from '$shared/types/dto';

	const tenantId = $derived(page.params.id as Id<'tenant'>);
</script>

<Page {tenantId} />
