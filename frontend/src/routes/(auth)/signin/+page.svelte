<script lang="ts">
	import Page from '$pages/signin/page.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page {data} />
