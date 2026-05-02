<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';

	type Props = {
		placeholder: string;
		value: string;
		class?: string;
		ariaLabel?: string;
		onsubmit: (event: SubmitEvent) => void;
		onclear: () => void;
	};

	let {
		placeholder,
		value = $bindable(),
		class: className = '',
		ariaLabel,
		onsubmit,
		onclear
	}: Props = $props();
</script>

<form class="flex gap-2 {className}" onsubmit={onsubmit} role="search">
	<div class="relative flex-1 min-w-0">
		<Input
			type="search"
			{placeholder}
			bind:value
			aria-label={ariaLabel ?? placeholder}
			class="pr-8 w-full"
		/>
		{#if value}
			<button
				type="button"
				class="absolute right-1.5 top-1/2 -translate-y-1/2 size-6 rounded hover:bg-muted flex items-center justify-center"
				onclick={onclear}
				aria-label="Clear search"
			>
				<X class="size-3.5" />
			</button>
		{/if}
	</div>
	<Button type="submit" disabled={value.trim().length === 0}>
		<Search class="size-4" />
	</Button>
</form>
