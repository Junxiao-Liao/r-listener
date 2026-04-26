<script lang="ts">
	import { page } from '$app/state';
	import AppShell from '$shared/components/shell/AppShell.svelte';
	import BottomNav from '$shared/components/shell/BottomNav.svelte';

	let { children } = $props();

	// Hide the bottom nav on the tenant picker — the user has not chosen a workspace yet.
	const showNav = $derived(page.url.pathname !== '/tenants');
</script>

<AppShell>
	{@render children()}
	{#snippet bottomNav()}
		{#if showNav}
			<BottomNav />
		{/if}
	{/snippet}
</AppShell>
