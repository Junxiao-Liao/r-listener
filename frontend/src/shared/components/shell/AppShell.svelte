<script lang="ts">
	type Props = {
		children: import('svelte').Snippet;
		bottomNav?: import('svelte').Snippet;
	};
	let { children, bottomNav }: Props = $props();
</script>

<div class="min-h-screen bg-background text-foreground">
	<main
		class="mx-auto w-full max-w-[var(--content-max-w)] px-4 pt-[var(--safe-top)]"
		style="padding-bottom: calc(var(--bottom-nav-h) + var(--safe-bottom) + 1rem);"
	>
		{@render children()}
	</main>
	{#if bottomNav}
		<div
			class="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[var(--content-max-w)] border-t border-border bg-background/95 backdrop-blur"
			style="padding-bottom: var(--safe-bottom);"
		>
			{@render bottomNav()}
		</div>
	{/if}
</div>
