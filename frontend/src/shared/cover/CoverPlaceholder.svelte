<script lang="ts">
	import { makeCoverPlaceholder } from './cover';
	import { cn } from '$shared/utils';

	type Props = {
		seed: string | null | undefined;
		class?: string;
		ariaLabel?: string;
	};

	let { seed, class: className, ariaLabel }: Props = $props();

	const placeholder = $derived(makeCoverPlaceholder(seed));
</script>

<span
	role="img"
	aria-label={ariaLabel ?? 'Cover placeholder'}
	class={cn(
		'inline-flex items-center justify-center rounded-md text-base font-semibold text-white select-none',
		className
	)}
	style:background-color={placeholder.bg}
>
	{placeholder.letter}
</span>
