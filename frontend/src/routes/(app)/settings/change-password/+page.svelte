<script lang="ts">
	import Page from '$pages/change-password/page.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page {data} />
