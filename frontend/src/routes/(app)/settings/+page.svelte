<script lang="ts">
	import Page from '$pages/settings/page.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page {data} />
