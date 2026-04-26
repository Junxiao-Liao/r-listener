<script lang="ts">
	import { page } from '$app/state';
	import House from '@lucide/svelte/icons/house';
	import Library from '@lucide/svelte/icons/library';
	import Upload from '@lucide/svelte/icons/upload';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Settings from '@lucide/svelte/icons/settings';
	import { cn } from '$shared/utils';

	type Tab = {
		href: string | null;
		label: string;
		icon: typeof House;
	};

	let { tabs }: { tabs?: Tab[] } = $props();

	const fallback: Tab[] = [
		{ href: '/', label: 'Home', icon: House },
		{ href: null, label: 'Library', icon: Library },
		{ href: null, label: 'Upload', icon: Upload },
		{ href: null, label: 'Playlists', icon: ListMusic },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	const items = $derived(tabs ?? fallback);
</script>

<nav
	class="grid grid-cols-5"
	style="height: var(--bottom-nav-h);"
	aria-label="Primary"
>
	{#each items as item (item.label)}
		{@const Icon = item.icon}
		{@const active = item.href !== null && page.url.pathname === item.href}
		{@const disabled = item.href === null}
		{#if disabled}
			<button
				type="button"
				disabled
				class="flex flex-col items-center justify-center gap-0.5 text-[0.65rem] text-muted-foreground/50"
				aria-disabled="true"
			>
				<Icon class="size-5" aria-hidden="true" />
				<span>{item.label}</span>
			</button>
		{:else}
			<a
				href={item.href}
				class={cn(
					'flex flex-col items-center justify-center gap-0.5 text-[0.65rem]',
					active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
				)}
			>
				<Icon class="size-5" aria-hidden="true" />
				<span>{item.label}</span>
			</a>
		{/if}
	{/each}
</nav>
