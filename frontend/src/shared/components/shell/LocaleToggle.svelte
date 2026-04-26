<script lang="ts">
	import { setLocale, getLocale } from '$shared/paraglide/runtime';
	import { cn } from '$shared/utils';

	const options = [
		{ value: 'en', label: 'EN' },
		{ value: 'zh', label: '中文' }
	] as const;

	let current = $state(getLocale());

	function pick(locale: 'en' | 'zh') {
		current = locale;
		setLocale(locale);
	}
</script>

<div class="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 p-0.5 text-xs">
	{#each options as opt (opt.value)}
		<button
			type="button"
			onclick={() => pick(opt.value)}
			class={cn(
				'rounded-full px-2 py-1 leading-none transition-colors',
				current === opt.value
					? 'bg-foreground text-background'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			{opt.label}
		</button>
	{/each}
</div>
