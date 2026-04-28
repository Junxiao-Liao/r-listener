<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AppShell from '$shared/components/shell/AppShell.svelte';
	import BottomNav from '$shared/components/shell/BottomNav.svelte';
	import { useSessionQuery } from '$shared/query/session.query';

	let { children } = $props();

	const session = useSessionQuery();

	$effect(() => {
		if ($session.isPending) return;
		if (!$session.data) {
			void goto('/signin', { replaceState: true });
			return;
		}
		if (!$session.data.activeTenantId && page.url.pathname !== '/tenants') {
			void goto('/tenants', { replaceState: true });
		}
	});

	const showNav = $derived(page.url.pathname !== '/tenants');
	const ready = $derived(
		!$session.isPending &&
			!!$session.data &&
			(!!$session.data.activeTenantId || page.url.pathname === '/tenants')
	);
</script>

<AppShell>
	{#if ready}
		{@render children()}
	{/if}
	{#snippet bottomNav()}
		{#if showNav && ready}
			<BottomNav />
		{/if}
	{/snippet}
</AppShell>
