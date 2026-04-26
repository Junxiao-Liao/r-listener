<script lang="ts">
	type Props = {
		children: import('svelte').Snippet;
		corner?: import('svelte').Snippet;
	};
	let { children, corner }: Props = $props();
</script>

<div class="relative min-h-screen bg-background text-foreground">
	{#if corner}
		<div class="absolute right-4 top-[calc(var(--safe-top)+1rem)]">
			{@render corner()}
		</div>
	{/if}
	<div class="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
		{@render children()}
	</div>
</div>
