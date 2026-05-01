<script lang="ts">
	import { page } from '$app/state';
	import House from '@lucide/svelte/icons/house';
	import Library from '@lucide/svelte/icons/library';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Mic2 from '@lucide/svelte/icons/mic-2';
	import Settings from '@lucide/svelte/icons/settings';
	import * as m from '$shared/paraglide/messages';
	import { cn } from '$shared/utils';

	type Tab = {
		href: string | null;
		label: string | (() => string);
		icon: typeof House;
	};

	let { tabs }: { tabs?: Tab[] } = $props();

	const fallback: Tab[] = [
		{ href: '/', label: m.nav_home, icon: House },
		{ href: '/library', label: m.nav_library, icon: Library },
		{ href: '/playlists', label: m.nav_playlists, icon: ListMusic },
		{ href: '/artists', label: m.nav_artists, icon: Mic2 },
		{ href: '/settings', label: m.nav_settings, icon: Settings }
	];

	const items = $derived(tabs ?? fallback);

	function getLabel(label: Tab['label']) {
		return typeof label === 'function' ? label() : label;
	}

	function isActive(href: string, current: string): boolean {
		if (href === '/') return current === '/';
		return current === href || current.startsWith(`${href}/`);
	}
</script>

<nav
	class="grid grid-cols-5"
	style="height: var(--bottom-nav-h);"
	aria-label={m.bottom_nav_aria_label()}
>
	{#each items as item (item.label)}
		{@const Icon = item.icon}
		{@const label = getLabel(item.label)}
		{@const active = item.href !== null && isActive(item.href, page.url.pathname)}
		{@const disabled = item.href === null}
		{#if disabled}
			<button
				type="button"
				disabled
				class="flex flex-col items-center justify-center gap-0.5 text-[0.65rem] text-muted-foreground/50"
				aria-disabled="true"
			>
				<Icon class="size-5" aria-hidden="true" />
				<span>{label}</span>
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
				<span>{label}</span>
			</a>
		{/if}
	{/each}
</nav>
