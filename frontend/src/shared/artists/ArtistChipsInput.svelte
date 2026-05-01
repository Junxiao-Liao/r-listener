<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { api } from '$shared/api/client';
	import * as m from '$shared/paraglide/messages';
	import type { ArtistDto, ListResponse } from '$shared/types/dto';
	import { dedupeArtistNames } from './artists';

	type Props = {
		value: string[];
		id?: string;
		placeholder?: string;
		disabled?: boolean;
	};

	let {
		value = $bindable([]),
		id = undefined,
		placeholder = '',
		disabled = false
	}: Props = $props();

	let query = $state('');
	let open = $state(false);
	let items = $state<ArtistDto[]>([]);
	let nextCursor = $state<string | null>(null);
	let loading = $state(false);
	let requestSeq = 0;

	$effect(() => {
		if (!open) return;
		const q = query.trim();
		void loadArtists('replace', q);
	});

	function addArtist(name: string) {
		value = dedupeArtistNames([...value, name]);
		query = '';
		open = true;
	}

	function removeArtist(name: string) {
		const key = name.trim().normalize('NFKC').toLocaleLowerCase();
		value = value.filter((item) => item.trim().normalize('NFKC').toLocaleLowerCase() !== key);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			const name = query.trim();
			if (name.length > 0) addArtist(name);
			return;
		}

		if (event.key === 'Backspace' && query.length === 0 && value.length > 0) {
			value = value.slice(0, -1);
		}
	}

	async function loadArtists(mode: 'replace' | 'append', q = query.trim()) {
		const seq = ++requestSeq;
		loading = true;
		const search = new URLSearchParams({ limit: '10' });
		if (q.length > 0) search.set('q', q);
		if (mode === 'append' && nextCursor) search.set('cursor', nextCursor);
		try {
			const page = await api<ListResponse<ArtistDto>>(`/artists?${search.toString()}`);
			if (seq !== requestSeq) return;
			const current = mode === 'append' ? items : [];
			const seen = new Set(current.map((item) => item.id));
			items = [...current, ...page.items.filter((item) => !seen.has(item.id))];
			nextCursor = page.nextCursor;
		} finally {
			if (seq === requestSeq) loading = false;
		}
	}

	function addQueryArtist(event: MouseEvent) {
		event.preventDefault();
		if (query.trim().length > 0) addArtist(query);
	}

	function addExistingArtist(event: MouseEvent, name: string) {
		event.preventDefault();
		addArtist(name);
	}

	function loadMore(event: MouseEvent) {
		event.preventDefault();
		void loadArtists('append');
	}
</script>

<div
	class="relative flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
>
	{#each value as name (name)}
		<span class="inline-flex max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5">
			<span class="truncate">{name}</span>
			<button
				type="button"
				class="grid size-4 place-items-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
				aria-label={`Remove ${name}`}
				{disabled}
				onclick={() => removeArtist(name)}
			>
				<X class="size-3" />
			</button>
		</span>
	{/each}
	<input
		{id}
		bind:value={query}
		{placeholder}
		{disabled}
		class="h-7 min-w-24 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
		onfocus={() => (open = true)}
		oninput={() => (open = true)}
		onkeydown={handleKeydown}
		onblur={() => setTimeout(() => (open = false), 120)}
	/>

	{#if open}
		<div
			class="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-background p-1 shadow-md"
		>
			{#if loading && items.length === 0}
				<p class="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
					<Loader2 class="size-3 animate-spin" />
					{m.admin_loading()}
				</p>
			{:else if items.length === 0 && query.trim().length > 0}
				<button
					type="button"
					class="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
					onmousedown={addQueryArtist}
				>
					{query.trim()}
				</button>
			{:else if items.length === 0}
				<p class="px-2 py-2 text-xs text-muted-foreground">{m.admin_no_results()}</p>
			{:else}
				{#each items as item (item.id)}
					<button
						type="button"
						class="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
						onmousedown={(event) => addExistingArtist(event, item.name)}
					>
						{item.name}
					</button>
				{/each}
				{#if nextCursor}
					<button
						type="button"
						class="w-full rounded-sm px-2 py-2 text-center text-xs text-muted-foreground hover:bg-muted"
						disabled={loading}
						onmousedown={loadMore}
					>
						{m.admin_load_more()}
					</button>
				{/if}
			{/if}
		</div>
	{/if}
</div>
