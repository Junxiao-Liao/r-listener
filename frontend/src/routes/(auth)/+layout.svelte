<script lang="ts">
	import AuthLayout from '$shared/components/shell/AuthLayout.svelte';
	import LocaleToggle from '$shared/components/shell/LocaleToggle.svelte';

	let { children } = $props();
</script>

<AuthLayout>
	{#snippet corner()}
		<LocaleToggle />
	{/snippet}
	{@render children()}
</AuthLayout>
