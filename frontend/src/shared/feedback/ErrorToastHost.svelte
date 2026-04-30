<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { buttonVariants } from '$shared/components/ui/button';
	import { errorToasts } from './error-toast.service';
</script>

{#if $errorToasts.length > 0}
	<div class="pointer-events-none fixed right-3 top-3 z-[80] grid w-[calc(100%-1.5rem)] max-w-sm gap-2">
		{#each $errorToasts as toast (toast.id)}
			<div
				role="alert"
				class="pointer-events-auto flex items-start gap-3 rounded-md border border-destructive/30 bg-background p-3 text-sm text-foreground shadow-lg"
			>
				<p class="min-w-0 flex-1 break-words text-destructive">{toast.message}</p>
				<button
					type="button"
					class={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
					aria-label="Dismiss error"
					onclick={() => errorToasts.dismiss(toast.id)}
				>
					<X class="size-3" />
				</button>
			</div>
		{/each}
	</div>
{/if}
